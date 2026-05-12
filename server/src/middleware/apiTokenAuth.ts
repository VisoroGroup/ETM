import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from '../config/database';
import { User } from '../types';
import { tError } from '../utils/serverErrors';

export interface ApiAuthRequest extends Request {
    user?: User;
    apiToken?: { id: string; name: string };
    /** All companies the API token's user has access to. Mirrors authMiddleware. */
    userCompanyIds?: number[];
    /** The currently selected company for this request (from X-Active-Company header, falls back to user's first). */
    activeCompanyId?: number;
}

/**
 * Hash a raw API token with SHA-256.
 */
export function hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a cryptographically secure random API token (64 hex chars = 32 bytes).
 */
export function generateApiToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Load the company context for the API-token user. Mirrors the JWT auth
 * middleware so external API endpoints have the same tenant scoping signal
 * (`req.userCompanyIds` + `req.activeCompanyId`) as JWT-authenticated routes.
 *
 * - superadmin / admin: every non-archived company
 * - everyone else: the user_companies rows for non-archived companies
 * Active company is resolved from the `X-Active-Company` header, falling back
 * to the user's first company.
 */
async function loadCompanyContext(req: ApiAuthRequest, userId: string, role: string): Promise<void> {
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

    const headerVal = req.headers['x-active-company'];
    const requested = Array.isArray(headerVal) ? Number(headerVal[0]) : Number(headerVal);
    if (Number.isFinite(requested) && companyIds.includes(requested)) {
        req.activeCompanyId = requested;
    } else {
        req.activeCompanyId = companyIds[0]; // may be undefined if user belongs to no companies
    }
}

/**
 * Middleware that authenticates requests using a Bearer API token.
 * Looks up the hashed token in api_tokens table, validates it's active,
 * and sets req.user to the token creator (for permission checks). Also
 * loads the user's company context so downstream handlers can tenant-scope
 * their queries — without this, an API token grants god-access across every
 * company the host serves.
 */
export async function apiTokenAuth(
    req: ApiAuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: tError(req, 'api_token_missing') });
        return;
    }

    const rawToken = authHeader.substring(7);
    const tokenHash = hashToken(rawToken);

    try {
        // Look up the token
        const { rows: tokenRows } = await pool.query(
            `SELECT id, name, created_by, expires_at
             FROM api_tokens
             WHERE token_hash = $1 AND is_active = true`,
            [tokenHash]
        );

        if (tokenRows.length === 0) {
            res.status(401).json({ error: tError(req, 'api_token_invalid') });
            return;
        }

        const apiToken = tokenRows[0];

        // Check expiry
        if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
            res.status(401).json({ error: tError(req, 'api_token_expired') });
            return;
        }

        // Get the user who created this token
        const { rows: userRows } = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [apiToken.created_by]
        );

        if (userRows.length === 0) {
            res.status(401).json({ error: tError(req, 'api_token_user_inactive') });
            return;
        }

        const tokenUser = userRows[0];

        // Update last_used_at (fire-and-forget, don't block the request)
        pool.query(
            'UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1',
            [apiToken.id]
        ).catch(err => console.error('Failed to update last_used_at:', err));

        // Set req.user to the token creator (inherits their permissions)
        req.user = tokenUser;
        req.apiToken = { id: apiToken.id, name: apiToken.name };

        // Load tenant context — mirrors JWT auth so external API endpoints can
        // scope every query by company_id.
        await loadCompanyContext(req, tokenUser.id, tokenUser.role);

        if (!req.userCompanyIds || req.userCompanyIds.length === 0) {
            res.status(401).json({
                error: tError(req, 'api_token_user_no_company')
            });
            return;
        }

        next();
    } catch (err) {
        console.error('API token auth error:', err);
        res.status(500).json({ error: tError(req, 'api_token_auth_error') });
    }
}
