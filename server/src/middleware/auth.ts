import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { User } from '../types';

interface JwtPayload {
    id: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

export interface AuthRequest extends Request {
    user?: User;
    /** All companies the user has access to. Superadmin/admin see all non-archived companies. */
    userCompanyIds?: number[];
    /** The currently selected company for this request (from X-Active-Company header, falls back to user's first). */
    activeCompanyId?: number;
}

async function loadCompanyContext(req: AuthRequest, userId: string, role: string): Promise<void> {
    // Superadmin and admin see every non-archived company.
    let companyIds: number[];
    if (role === 'superadmin' || role === 'admin') {
        const { rows } = await pool.query<{ id: number }>(
            'SELECT id FROM companies WHERE is_archived = false ORDER BY sort_order, id'
        );
        companyIds = rows.map((r) => r.id);
    } else {
        const { rows } = await pool.query<{ company_id: number }>(
            `SELECT uc.company_id
               FROM user_companies uc
               JOIN companies c ON c.id = uc.company_id
              WHERE uc.user_id = $1 AND c.is_archived = false
              ORDER BY c.sort_order, c.id`,
            [userId]
        );
        companyIds = rows.map((r) => r.company_id);
    }
    req.userCompanyIds = companyIds;

    // Resolve the active company from the X-Active-Company header.
    const headerVal = req.headers['x-active-company'];
    const requested = Array.isArray(headerVal) ? Number(headerVal[0]) : Number(headerVal);
    if (Number.isFinite(requested) && companyIds.includes(requested)) {
        req.activeCompanyId = requested;
    } else {
        req.activeCompanyId = companyIds[0]; // may be undefined if user belongs to no companies
    }
}

// JWT secret resolution: a hardcoded dev fallback is allowed only when we're
// confident we're on a developer's local machine — i.e. NODE_ENV is either
// unset (Node's default for `npm run dev`) or explicitly 'development'.
// Anywhere with a deployed-looking NODE_ENV (production, staging, test, ...)
// MUST configure JWT_SECRET, otherwise we refuse to run rather than silently
// use a known-public secret.
const DEFAULT_DEV_JWT_SECRET = 'visoro-task-manager-jwt-secret-dev-2024';
const isLocalDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
let JWT_SECRET: string;
if (process.env.JWT_SECRET) {
    JWT_SECRET = process.env.JWT_SECRET;
} else if (isLocalDev) {
    JWT_SECRET = DEFAULT_DEV_JWT_SECRET;
    console.warn('⚠️  JWT_SECRET not set — using development default. Do NOT use this in production.');
} else {
    throw new Error(`JWT_SECRET environment variable must be set (NODE_ENV=${process.env.NODE_ENV}).`);
}

export function generateToken(user: User, expiresIn: string = '24h'): string {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        // expiresIn accepts string forms like '24h', '30d', '15m'. Magic-link
        // logins pass '30d'; Microsoft SSO stays on the 24h default.
        { expiresIn: expiresIn as any }
    );
}

export async function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    // SELECT list for the user row loaded on every authed request. Explicitly
    // excludes the BYTEA avatar_data + avatar_mime columns (audit-3 H3):
    // those can be 100 KB+ each, and shipping them on every API call wastes
    // bandwidth (DB → Node → JSON-serialize, just to be discarded). Avatars
    // are served separately by /api/files/avatar/:userId.
    const USER_SELECT_COLS =
        'id, microsoft_id, email, display_name, avatar_url, departments, ' +
        'role, is_active, created_at, updated_at, deactivated_at, reports_to';

    // Dev mode bypass — NEVER active in production
    if (process.env.DEV_AUTH_BYPASS === 'true' && isLocalDev) {
        try {
            // Check if there's a token in the header
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
                    const { rows } = await pool.query(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = $1 AND is_active = true`, [decoded.id]);
                    if (rows.length > 0) {
                        req.user = rows[0];
                        await loadCompanyContext(req, rows[0].id, rows[0].role);
                        return next();
                    }
                } catch {
                    // Token invalid, fall through to dev user
                }
            }

            // Use the first user as dev user
            const { rows } = await pool.query(`SELECT ${USER_SELECT_COLS} FROM users WHERE is_active = true ORDER BY created_at LIMIT 1`);
            if (rows.length > 0) {
                req.user = rows[0];
                await loadCompanyContext(req, rows[0].id, rows[0].role);
                return next();
            }

            res.status(401).json({ error: 'Nu există utilizatori în baza de date. Rulează seed-ul.' });
            return;
        } catch (err) {
            res.status(500).json({ error: 'Eroare la autentificare dev.' });
            return;
        }
    }

    // Production mode - JWT validation
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token de autentificare lipsă.' });
        return;
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        const { rows } = await pool.query(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = $1 AND is_active = true`, [decoded.id]);

        if (rows.length === 0) {
            res.status(401).json({ error: 'Utilizator negăsit.' });
            return;
        }

        req.user = rows[0];
        await loadCompanyContext(req, rows[0].id, rows[0].role);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token invalid sau expirat.' });
    }
}

// Role hierarchy: every role implicitly grants access to all lower roles.
// superadmin > admin > manager > user
const ROLE_INHERITANCE: Record<string, string[]> = {
    superadmin: ['superadmin', 'admin', 'manager', 'user'],
    admin: ['admin', 'manager', 'user'],
    manager: ['manager', 'user'],
    user: ['user'],
};

export function requireRole(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Neautentificat.' });
            return;
        }

        const effectiveRoles = ROLE_INHERITANCE[req.user.role] ?? [req.user.role];

        if (!roles.some(r => effectiveRoles.includes(r))) {
            res.status(403).json({ error: 'Nu ai permisiunea necesară.' });
            return;
        }

        next();
    };
}
