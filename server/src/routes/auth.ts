import { Router, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import { ConfidentialClientApplication } from '@azure/msal-node';
import pool from '../config/database';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// MSAL config for server-side OAuth
const msalApp = new ConfidentialClientApplication({
    auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
    }
});

// GET /api/auth/microsoft — redirect to Microsoft OAuth
router.get('/microsoft', async (req: Request, res: Response): Promise<void> => {
    try {
        const redirectUri = `${process.env.SERVER_URL || `https://${req.headers.host}`}/api/auth/microsoft/callback`;
        const authUrl = await msalApp.getAuthCodeUrl({
            scopes: ['User.Read'],
            redirectUri,
        });
        res.redirect(authUrl);
    } catch (err) {
        console.error('Microsoft OAuth init error:', err);
        res.redirect('/?error=oauth_init_failed');
    }
});

// GET /api/auth/microsoft/callback — exchange code for token
router.get('/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.query;
        if (!code || typeof code !== 'string') {
            res.redirect('/?error=no_code');
            return;
        }

        const redirectUri = `${process.env.SERVER_URL || `https://${req.headers.host}`}/api/auth/microsoft/callback`;
        const tokenResponse = await msalApp.acquireTokenByCode({
            code,
            scopes: ['User.Read'],
            redirectUri,
        });

        // Get user info from Graph
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` }
        });
        const msUser = await graphResponse.json() as any;

        // Upsert user
        const { rows } = await pool.query(
            `INSERT INTO users (id, microsoft_id, email, display_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (microsoft_id) DO UPDATE SET
               email = EXCLUDED.email,
               display_name = EXCLUDED.display_name,
               updated_at = NOW()
             RETURNING *`,
            [uuidv4(), msUser.id, msUser.mail || msUser.userPrincipalName, msUser.displayName]
        );
        const user = rows[0];

        const token = generateToken(user);
        // Redirect to frontend with token
        res.redirect(`/?token=${token}`);
    } catch (err) {
        console.error('Microsoft OAuth callback error:', err);
        res.redirect('/?error=oauth_failed');
    }
});

// POST /api/auth/login — validate Microsoft token or dev login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Dev mode — login with microsoft_id or email
        if (process.env.DEV_AUTH_BYPASS === 'true') {
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
                    department: req.body.department || 'departament_1',
                    role: req.body.role || 'user'
                };

                const { rows } = await pool.query(
                    `INSERT INTO users (id, microsoft_id, email, display_name, avatar_url, department, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [devUser.id, devUser.microsoft_id, devUser.email, devUser.display_name,
                    devUser.avatar_url, devUser.department, devUser.role]
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

            const msUser = await graphResponse.json() as any;

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
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, email, display_name, avatar_url, department, role FROM users ORDER BY display_name'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la încărcarea utilizatorilor.' });
    }
});

// PUT /api/users/:id — update user (admin only for role/department)
router.put('/users/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { department, role } = req.body;

        // Only admin can change roles/departments
        if (req.user!.role !== 'admin' && req.user!.id !== id) {
            res.status(403).json({ error: 'Nu ai permisiunea necesară.' });
            return;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (department) {
            updates.push(`department = $${paramIndex++}`);
            values.push(department);
        }
        if (role && req.user!.role === 'admin') {
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
