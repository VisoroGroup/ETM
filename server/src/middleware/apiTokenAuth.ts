import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from '../config/database';
import { User } from '../types';

export interface ApiAuthRequest extends Request {
    user?: User;
    apiToken?: { id: string; name: string };
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
 * Middleware that authenticates requests using a Bearer API token.
 * Looks up the hashed token in api_tokens table, validates it's active,
 * and sets req.user to the token creator (for permission checks).
 */
export async function apiTokenAuth(
    req: ApiAuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'API token lipsă. Utilizează header-ul: Authorization: Bearer <token>' });
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
            res.status(401).json({ error: 'Token API invalid sau revocat.' });
            return;
        }

        const apiToken = tokenRows[0];

        // Check expiry
        if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
            res.status(401).json({ error: 'Token API expirat.' });
            return;
        }

        // Get the user who created this token
        const { rows: userRows } = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [apiToken.created_by]
        );

        if (userRows.length === 0) {
            res.status(401).json({ error: 'Utilizatorul asociat token-ului nu mai este activ.' });
            return;
        }

        // Update last_used_at (fire-and-forget, don't block the request)
        pool.query(
            'UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1',
            [apiToken.id]
        ).catch(err => console.error('Failed to update last_used_at:', err));

        // Set req.user to the token creator (inherits their permissions)
        req.user = userRows[0];
        req.apiToken = { id: apiToken.id, name: apiToken.name };

        next();
    } catch (err) {
        console.error('API token auth error:', err);
        res.status(500).json({ error: 'Eroare la autentificarea cu token API.' });
    }
}
