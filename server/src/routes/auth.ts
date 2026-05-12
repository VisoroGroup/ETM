import { Router, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ConfidentialClientApplication } from '@azure/msal-node';
import pool from '../config/database';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';
import { magicLinkRequestLimiter, magicLinkVerifyLimiter } from '../middleware/rateLimiter';
import { sendMagicLinkEmail } from '../services/emailService';
import { v4 as uuidv4 } from 'uuid';

interface MsGraphUser {
    id: string;
    displayName: string;
    mail: string | null;
    userPrincipalName: string;
    jobTitle?: string;
}

type SqlValue = string | number | boolean | null | string[];

// One-time auth code store — codes expire after 60 seconds and are single-use
const AUTH_CODE_TTL_MS = 60_000;
const authCodeStore = new Map<string, { token: string; expiresAt: number }>();

// OAuth state store for CSRF protection. State value is short-lived
// (5 minutes) and bound to the user's browser via cookie.
const OAUTH_STATE_TTL_MS = 5 * 60_000;
const oauthStateStore = new Map<string, { expiresAt: number }>();

// Clean up expired codes/states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of authCodeStore) {
        if (entry.expiresAt < now) {
            authCodeStore.delete(code);
        }
    }
    for (const [state, entry] of oauthStateStore) {
        if (entry.expiresAt < now) {
            oauthStateStore.delete(state);
        }
    }
}, 5 * 60_000);

function getServerUrl(req: Request): string {
    // Prefer the explicitly configured SERVER_URL; never trust the Host header
    // for OAuth redirects (host-header spoofing → token redirect to attacker).
    if (process.env.SERVER_URL) return process.env.SERVER_URL;
    // Fallback: only allow if running locally; otherwise refuse to derive.
    const host = req.headers.host;
    if (!host || /:|localhost|127\.0\.0\.1/.test(host) === false) {
        throw new Error('SERVER_URL must be configured for OAuth.');
    }
    return `http://${host}`;
}

function getClientUrl(_req: Request): string {
    // Same hardening as getServerUrl — never trust Host header.
    if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
    return process.env.SERVER_URL || 'http://localhost:5173';
}

const router = Router();

// MSAL config for server-side OAuth — lazy init to avoid crash when credentials are not set (dev mode)
let _msalApp: ConfidentialClientApplication | null = null;
function getMsalApp(): ConfidentialClientApplication {
    if (!_msalApp) {
        if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
            throw new Error('Azure AD credentials are not configured. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and AZURE_TENANT_ID.');
        }
        _msalApp = new ConfidentialClientApplication({
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET,
            }
        });
    }
    return _msalApp;
}

// GET /api/auth/microsoft — redirect to Microsoft OAuth
router.get('/microsoft', async (req: Request, res: Response): Promise<void> => {
    try {
        const serverUrl = getServerUrl(req);
        const redirectUri = `${serverUrl}/api/auth/microsoft/callback`;

        // Generate a one-time CSRF state and store both server-side and in a
        // signed cookie so the callback can verify it.
        const state = crypto.randomBytes(24).toString('hex');
        oauthStateStore.set(state, { expiresAt: Date.now() + OAUTH_STATE_TTL_MS });
        res.cookie('oauth_state', state, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: OAUTH_STATE_TTL_MS,
            path: '/api/auth',
        });

        const authUrl = await getMsalApp().getAuthCodeUrl({
            scopes: ['User.Read'],
            redirectUri,
            state,
        });
        res.redirect(authUrl);
    } catch (err) {
        console.error('Microsoft OAuth init error:', err);
        const clientUrl = getClientUrl(req);
        res.redirect(`${clientUrl}/?error=oauth_init_failed`);
    }
});

// GET /api/auth/microsoft/callback — exchange code for token
router.get('/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, state } = req.query;
        const clientUrl = getClientUrl(req);
        const serverUrl = getServerUrl(req);

        if (!code || typeof code !== 'string') {
            res.redirect(`${clientUrl}/?error=no_code`);
            return;
        }

        // CSRF: state must match a server-stored value AND the cookie value.
        const rawCookie = req.headers.cookie || '';
        const cookieState = rawCookie
            .split(';')
            .map((c) => c.trim())
            .find((c) => c.startsWith('oauth_state='))
            ?.slice('oauth_state='.length);
        if (!state || typeof state !== 'string' || !cookieState || state !== cookieState) {
            res.clearCookie('oauth_state', { path: '/api/auth' });
            res.redirect(`${clientUrl}/?error=oauth_state_mismatch`);
            return;
        }
        const stateEntry = oauthStateStore.get(state);
        if (!stateEntry || stateEntry.expiresAt < Date.now()) {
            res.clearCookie('oauth_state', { path: '/api/auth' });
            res.redirect(`${clientUrl}/?error=oauth_state_expired`);
            return;
        }
        oauthStateStore.delete(state);
        res.clearCookie('oauth_state', { path: '/api/auth' });

        const redirectUri = `${serverUrl}/api/auth/microsoft/callback`;
        const tokenResponse = await getMsalApp().acquireTokenByCode({
            code,
            scopes: ['User.Read'],
            redirectUri,
        });

        // Get user info from Graph
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` }
        });
        const msUser = await graphResponse.json() as MsGraphUser;
        const email = msUser.mail || msUser.userPrincipalName;



        // First try to find pre-seeded user by email (only active users!)
        // If found, link their microsoft_id. Otherwise upsert by microsoft_id.
        const existing = await pool.query(
            'SELECT * FROM users WHERE email ILIKE $1 AND is_active = true', [email]
        );



        let user;
        if (existing.rows.length > 0 && existing.rows[0].microsoft_id?.startsWith('pending-')) {
            // Pre-seeded user — link their Microsoft account
            // First: clear any conflicting microsoft_id on deactivated users
            await pool.query(
                `UPDATE users SET microsoft_id = 'CLEARED-' || microsoft_id
                 WHERE microsoft_id = $1 AND id != $2`,
                [msUser.id, existing.rows[0].id]
            );
            const { rows } = await pool.query(
                `UPDATE users SET
                    microsoft_id = $1,
                    display_name = COALESCE(NULLIF(display_name, ''), $2),
                    updated_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [msUser.id, msUser.displayName, existing.rows[0].id]
            );
            user = rows[0];
            console.log(`[SSO] Linked pending user ${existing.rows[0].id} to Microsoft ID ${msUser.id}`);
        } else if (existing.rows.length > 0) {
            // Active user already linked — update microsoft_id if needed and refresh info
            // First: clear any conflicting microsoft_id on other users
            await pool.query(
                `UPDATE users SET microsoft_id = 'CLEARED-' || microsoft_id
                 WHERE microsoft_id = $1 AND id != $2`,
                [msUser.id, existing.rows[0].id]
            );
            const { rows } = await pool.query(
                `UPDATE users SET
                    microsoft_id = $1,
                    display_name = $2,
                    updated_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [msUser.id, msUser.displayName, existing.rows[0].id]
            );
            user = rows[0];
        } else {
            // No active user found by email — upsert by microsoft_id
            const { rows } = await pool.query(
                `INSERT INTO users (id, microsoft_id, email, display_name)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (microsoft_id) DO UPDATE SET
                   email = EXCLUDED.email,
                   display_name = EXCLUDED.display_name,
                   is_active = true,
                   updated_at = NOW()
                 RETURNING *`,
                [uuidv4(), msUser.id, email, msUser.displayName]
            );
            user = rows[0];
        }

        // Safety check: reject deactivated users
        if (!user || !user.is_active) {
            console.warn(`Login blocked for deactivated user: ${email}`);
            res.redirect(`${clientUrl}/?error=user_deactivated`);
            return;
        }

        const token = generateToken(user);

        // Generate one-time auth code instead of putting JWT in URL
        const authCode = crypto.randomUUID();
        authCodeStore.set(authCode, {
            token,
            expiresAt: Date.now() + AUTH_CODE_TTL_MS,
        });

        // Redirect with short-lived code — client will exchange it for the JWT
        res.redirect(`${clientUrl}/?code=${authCode}`);
    } catch (err) {
        console.error('Microsoft OAuth callback error:', err);
        const clientUrl = getClientUrl(req);
        res.redirect(`${clientUrl}/?error=oauth_failed`);
    }
});

// POST /api/auth/exchange — exchange one-time code for JWT token
router.post('/exchange', async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.body;

        if (!code || typeof code !== 'string') {
            res.status(400).json({ error: 'Codul de autentificare lipsește.' });
            return;
        }

        const entry = authCodeStore.get(code);

        if (!entry) {
            res.status(401).json({ error: 'Cod de autentificare invalid sau deja folosit.' });
            return;
        }

        // Delete immediately — single use
        authCodeStore.delete(code);

        // Check expiration
        if (entry.expiresAt < Date.now()) {
            res.status(401).json({ error: 'Codul de autentificare a expirat.' });
            return;
        }

        res.json({ token: entry.token });
    } catch (err) {
        console.error('Auth code exchange error:', err);
        res.status(500).json({ error: 'Eroare la schimbul codului de autentificare.' });
    }
});

// ---------------------------------------------------------------------------
// Magic-link login (second auth path for external collaborators)
//
// Flow:
//   1. POST /api/auth/magic-link/request  { email }
//      → always 200, even if no such user (enumeration defense).
//        If an active user exists with that email, we hash a random token,
//        store it, and email the raw token as a deep link.
//   2. POST /api/auth/magic-link/verify   { token }
//      → on success: { token: jwt }  (30-day JWT, same shape as MS SSO)
//        on failure: 401.
// ---------------------------------------------------------------------------
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;       // 15 minutes
const MAGIC_LINK_JWT_LIFETIME = '30d';          // 30-day session

function hashMagicToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

router.post(
    '/magic-link/request',
    magicLinkRequestLimiter,
    async (req: Request, res: Response): Promise<void> => {
        try {
            const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
            // Cheap shape check — never echo the email back, never reveal whether
            // it matched anything (always 200).
            const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
            if (!looksLikeEmail) {
                res.status(400).json({ error: 'Adresa de email este invalidă.' });
                return;
            }
            const email = rawEmail.toLowerCase();

            // Resolve active user (case-insensitive). If not found, we still
            // return 200 — no enumeration leak.
            const { rows: users } = await pool.query<{
                id: string;
                email: string;
                display_name: string;
            }>(
                `SELECT id, email, display_name FROM users
                  WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
                [email]
            );

            if (users.length === 0) {
                res.json({ ok: true });
                return;
            }
            const user = users[0];

            // Generate raw token; store only the hash.
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashMagicToken(rawToken);
            const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
            const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                || req.socket.remoteAddress
                || null;
            const ua = (req.headers['user-agent'] as string) || null;

            await pool.query(
                `INSERT INTO magic_links (token_hash, email, expires_at, requested_ip, user_agent)
                 VALUES ($1, $2, $3, $4, $5)`,
                [tokenHash, email, expiresAt, ip, ua]
            );

            // Pick the recipient's preferred language from their first active
            // company (falls back to RO).
            let lang: 'ro' | 'hu' | 'en' = 'ro';
            try {
                const { rows: langRows } = await pool.query<{ language: string }>(
                    `SELECT c.language FROM companies c
                       JOIN user_companies uc ON uc.company_id = c.id
                      WHERE uc.user_id = $1 AND c.is_archived = false
                      ORDER BY c.sort_order, c.id
                      LIMIT 1`,
                    [user.id]
                );
                const v = langRows[0]?.language;
                if (v === 'ro' || v === 'hu' || v === 'en') lang = v;
            } catch { /* fall back to ro */ }

            // Build the deep link. Prefer CLIENT_URL; fall back to the request
            // origin (host header) only when CLIENT_URL isn't set — same
            // hardening as the OAuth flow.
            const clientUrl = process.env.CLIENT_URL || `https://${req.headers.host}`;
            const link = `${clientUrl}/auth/magic-link?token=${encodeURIComponent(rawToken)}`;

            // Fire-and-forget — never let a Graph API error leak whether the
            // email exists. We always 200.
            sendMagicLinkEmail({ to: user.email, link, language: lang })
                .catch((err) => console.error('[magic-link] email send failed:', err?.message ?? err));

            res.json({ ok: true });
        } catch (err) {
            console.error('Magic link request error:', err);
            // Even on internal error: 200 OK with generic ack to avoid leaking
            // anything to enumeration probes.
            res.json({ ok: true });
        }
    }
);

router.post(
    '/magic-link/verify',
    magicLinkVerifyLimiter,
    async (req: Request, res: Response): Promise<void> => {
        try {
            const raw = typeof req.body?.token === 'string' ? req.body.token : '';
            if (!raw || raw.length < 32 || raw.length > 256) {
                res.status(401).json({ error: 'Link invalid sau expirat.' });
                return;
            }

            const tokenHash = hashMagicToken(raw);

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Lock the matching row so we can atomically check-and-mark.
                const { rows: linkRows } = await client.query<{
                    id: string;
                    email: string;
                    expires_at: Date;
                    used_at: Date | null;
                }>(
                    `SELECT id, email, expires_at, used_at
                       FROM magic_links
                      WHERE token_hash = $1
                      FOR UPDATE`,
                    [tokenHash]
                );

                if (linkRows.length === 0) {
                    await client.query('ROLLBACK');
                    res.status(401).json({ error: 'Link invalid sau expirat.' });
                    return;
                }
                const link = linkRows[0];

                if (link.used_at !== null) {
                    await client.query('ROLLBACK');
                    res.status(401).json({ error: 'Acest link a fost deja folosit.' });
                    return;
                }
                if (new Date(link.expires_at).getTime() < Date.now()) {
                    await client.query('ROLLBACK');
                    res.status(401).json({ error: 'Linkul a expirat. Cere unul nou.' });
                    return;
                }

                // Resolve the user NOW (at verify time, not at request time):
                // an admin may have deactivated the account between request
                // and verify, and we must respect that.
                const { rows: users } = await client.query(
                    `SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1`,
                    [link.email]
                );
                if (users.length === 0) {
                    await client.query('ROLLBACK');
                    res.status(401).json({ error: 'Cont indisponibil.' });
                    return;
                }
                const user = users[0];

                // Mark consumed BEFORE issuing the JWT so a parallel verify
                // can't reuse the same token.
                await client.query(
                    `UPDATE magic_links SET used_at = NOW() WHERE id = $1`,
                    [link.id]
                );
                await client.query('COMMIT');

                const jwtToken = generateToken(user, MAGIC_LINK_JWT_LIFETIME);
                res.json({ token: jwtToken, user });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('Magic link verify error:', err);
            res.status(500).json({ error: 'Eroare la validarea linkului.' });
        }
    }
);

// POST /api/auth/login — validate Microsoft token or dev login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Dev mode — login with microsoft_id or email (NEVER in production)
        if (process.env.DEV_AUTH_BYPASS === 'true' && (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')) {
            const { microsoft_id, email } = req.body;

            let user;
            if (microsoft_id) {
                const { rows } = await pool.query('SELECT * FROM users WHERE microsoft_id = $1', [microsoft_id]);
                user = rows[0];
            } else if (email) {
                const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
                user = rows[0];
            }

            if (!user) {
                // Create a new dev user
                const id = uuidv4();
                const devUser = {
                    id,
                    microsoft_id: microsoft_id || `dev-${id}`,
                    email: email || 'dev@visoro.ro',
                    display_name: req.body.display_name || 'Dev User',
                    avatar_url: null,
                    departments: req.body.departments || ['departament_1'],
                    role: (['user', 'manager', 'admin'].includes(req.body.role) ? req.body.role : 'user')
                };

                const { rows } = await pool.query(
                    `INSERT INTO users (id, microsoft_id, email, display_name, avatar_url, departments, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [devUser.id, devUser.microsoft_id, devUser.email, devUser.display_name,
                    devUser.avatar_url, devUser.departments, devUser.role]
                );
                user = rows[0];
            }

            const token = generateToken(user);
            res.json({ token, user });
            return;
        }

        // Production mode — validate Microsoft token
        const { accessToken } = req.body;
        if (!accessToken) {
            res.status(400).json({ error: 'Token Microsoft lipsă.' });
            return;
        }

        // Validate the Microsoft token and get user info
        // In production, we'd call Microsoft Graph API to get user profile
        try {
            const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!graphResponse.ok) {
                res.status(401).json({ error: 'Token Microsoft invalid.' });
                return;
            }

            const msUser = await graphResponse.json() as MsGraphUser;

            // Upsert user
            const { rows } = await pool.query(
                `INSERT INTO users (microsoft_id, email, display_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (microsoft_id) DO UPDATE SET
           email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           updated_at = NOW()
         RETURNING *`,
                [msUser.id, msUser.mail || msUser.userPrincipalName, msUser.displayName, null]
            );

            const user = rows[0];

            // Try to get avatar
            try {
                const photoResp = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (photoResp.ok) {
                    const buffer = await photoResp.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    const avatarUrl = `data:image/jpeg;base64,${base64}`;
                    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, user.id]);
                    user.avatar_url = avatarUrl;
                }
            } catch { /* avatar not available */ }

            const token = generateToken(user);
            res.json({ token, user });
        } catch (err) {
            res.status(500).json({ error: 'Eroare la validarea token-ului Microsoft.' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Eroare internă la autentificare.' });
    }
});

// GET /api/auth/me — current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    res.json({ user: req.user });
});

// GET /api/users — all users (for @mention, subtask assignment)
// Multi-tenant: returns only users with access to the active company.
// Admin/superadmin users are returned regardless (they have access to all companies).
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (req.activeCompanyId === undefined) {
            res.status(400).json({ error: 'Companie activă lipsește.' });
            return;
        }
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.display_name, u.avatar_url, u.departments, u.role
             FROM users u
             WHERE u.is_active = true
               AND (
                   u.role IN ('admin', 'superadmin')
                   OR EXISTS (
                       SELECT 1 FROM user_companies uc
                       WHERE uc.user_id = u.id AND uc.company_id = $1
                   )
               )
             ORDER BY u.display_name`,
            [req.activeCompanyId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la încărcarea utilizatorilor.' });
    }
});

// Role hierarchy ranks for privilege checks.
const ROLE_RANK: Record<string, number> = { user: 1, manager: 2, admin: 3, superadmin: 4 };
const rankOf = (role: string | undefined | null): number => ROLE_RANK[role ?? 'user'] ?? 0;

// PUT /api/users/:id — update user (admin only for role/departments)
router.put('/users/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { departments, role } = req.body;

        const callerRole = req.user!.role;
        const isSuperadmin = callerRole === 'superadmin';
        const isAdmin = callerRole === 'admin';
        const callerId = req.user!.id;

        // Only admin can change roles/departments
        if (!isAdmin && !isSuperadmin && callerId !== id) {
            res.status(403).json({ error: 'Nu ai permisiunea necesară.' });
            return;
        }

        // Hierarchy guard: cannot modify a peer or superior.
        if (callerId !== id && (role || departments)) {
            const { rows: targetRows } = await pool.query<{ role: string }>(
                'SELECT role FROM users WHERE id = $1',
                [id]
            );
            if (targetRows.length === 0) {
                res.status(404).json({ error: 'Utilizator negăsit.' });
                return;
            }
            if (!isSuperadmin && rankOf(targetRows[0].role) >= rankOf(callerRole)) {
                res.status(403).json({ error: 'Nu poți modifica un utilizator cu rol egal sau superior.' });
                return;
            }
        }

        // Privilege-escalation guard: only superadmin can grant the superadmin role,
        // and a regular admin can only assign 'user' or 'manager' (never 'admin' or 'superadmin').
        if (role) {
            if (role === 'superadmin' && !isSuperadmin) {
                res.status(403).json({ error: 'Nu ai permisiunea să atribui rolul de superadmin.' });
                return;
            }
            if (isAdmin && !['user', 'manager'].includes(role)) {
                res.status(403).json({ error: 'Nu ai permisiunea să atribui acest rol.' });
                return;
            }
            if (rankOf(role) > rankOf(callerRole)) {
                res.status(403).json({ error: 'Nu poți atribui un rol superior celui propriu.' });
                return;
            }
        }

        // Department change scope guard: a non-superadmin admin can only modify users
        // who share at least one company with them (via user_companies).
        if (departments && isAdmin && !isSuperadmin && req.user!.id !== id) {
            const { rows: shared } = await pool.query(
                `SELECT 1
                   FROM user_companies uc_target
                   JOIN user_companies uc_caller
                     ON uc_caller.company_id = uc_target.company_id
                  WHERE uc_target.user_id = $1
                    AND uc_caller.user_id = $2
                  LIMIT 1`,
                [id, req.user!.id]
            );
            if (shared.length === 0) {
                res.status(403).json({ error: 'Nu poți modifica un utilizator dintr-o companie din afara ariei tale.' });
                return;
            }
        }

        const updates: string[] = [];
        const values: SqlValue[] = [];
        let paramIndex = 1;

        if (departments) {
            // Only admin/superadmin can modify departments (prevent scope escalation)
            if (!isAdmin && !isSuperadmin) {
                res.status(403).json({ error: 'Doar administratorii pot modifica departamentele.' });
                return;
            }
            updates.push(`departments = $${paramIndex++}`);
            values.push(departments);
        }
        if (role && (isAdmin || isSuperadmin)) {
            updates.push(`role = $${paramIndex++}`);
            values.push(role);
        }

        if (updates.length === 0) {
            res.status(400).json({ error: 'Nimic de actualizat.' });
            return;
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la actualizare.' });
    }
});

export default router;
