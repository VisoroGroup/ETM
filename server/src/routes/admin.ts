import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { generateApiToken, hashToken } from '../middleware/apiTokenAuth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// --- Avatar upload setup for admin (memory storage — stored in DB) ---
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Doar imagini (jpg, png, gif, webp) sunt permise.'));
        }
    }
});

// GET /api/admin/users — list all users with their departments and roles
router.get('/users', asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, microsoft_id, email, display_name, avatar_url, departments, role, is_active, created_at, updated_at
            FROM users
            WHERE is_active = true
            ORDER BY display_name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea utilizatorilor.' });
    }
}));

// PATCH /api/admin/users/:id — update user role and/or departments
router.patch('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { role, departments } = req.body;

    const allowed_roles = ['admin', 'manager', 'user'];
    const allowed_departments = ['departament_1', 'departament_2', 'departament_3', 'departament_4', 'departament_5', 'departament_6', 'departament_7'];

    if (role && !allowed_roles.includes(role)) {
        res.status(400).json({ error: 'Rol invalid.' });
        return;
    }

    if (departments) {
        if (!Array.isArray(departments)) {
            res.status(400).json({ error: 'Departamentele trebuie să fie un array.' });
            return;
        }
        for (const d of departments) {
            if (!allowed_departments.includes(d)) {
                res.status(400).json({ error: `Departament invalid: ${d}` });
                return;
            }
        }
    }

    try {
        const setParts: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (role) { setParts.push(`role = $${idx++}`); values.push(role); }
        if (departments) { setParts.push(`departments = $${idx++}`); values.push(departments); }

        if (setParts.length === 0) {
            res.status(400).json({ error: 'Nimic de actualizat.' });
            return;
        }

        setParts.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE users SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ error: 'Eroare la actualizarea utilizatorului.' });
    }
}));

// DELETE /api/admin/users/:id — deactivate (soft delete via role change, not actual delete)
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (req.user?.id === id) {
        res.status(400).json({ error: 'Nu poți șterge propriul cont.' });
        return;
    }

    try {
        const { rows } = await pool.query(
            `UPDATE users SET is_active = false, deactivated_at = NOW() WHERE id = $1 AND is_active = true RETURNING id, display_name`,
            [id]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        res.json({ success: true, deactivated: rows[0] });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Eroare la ștergerea utilizatorului.' });
    }
}));

// GET /api/admin/stats — overview stats for admin
router.get('/stats', asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
        const { rows: [stats] } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                (SELECT COUNT(*) FROM tasks) as total_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'terminat') as completed_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'blocat') as blocked_tasks,
                (SELECT COUNT(*) FROM tasks WHERE due_date < NOW() AND status != 'terminat') as overdue_tasks
        `);
        res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor.' });
    }
}));

// ==========================================
// API TOKEN MANAGEMENT
// ==========================================

// POST /api/admin/api-tokens — generate a new API token
router.post('/api-tokens', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { name, expires_at } = req.body;

        if (!name || name.trim() === '') {
            res.status(400).json({ error: 'Numele token-ului este obligatoriu.' });
            return;
        }

        const rawToken = generateApiToken();
        const tokenHash = hashToken(rawToken);

        const { rows } = await pool.query(
            `INSERT INTO api_tokens (token_hash, name, created_by, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, created_at, expires_at`,
            [tokenHash, name.trim(), req.user!.id, expires_at || null]
        );

        // Return the raw token ONCE — it will never be shown again
        res.status(201).json({
            ...rows[0],
            token: rawToken,
            message: 'Salvează acest token! Nu va mai fi afișat.'
        });
    } catch (err) {
        console.error('Generate API token error:', err);
        res.status(500).json({ error: 'Eroare la generarea token-ului.' });
    }
}));

// GET /api/admin/api-tokens — list all tokens (without hashes)
router.get('/api-tokens', asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT at.id, at.name, at.is_active, at.created_at, at.last_used_at, at.expires_at,
                   u.display_name AS created_by_name
            FROM api_tokens at
            JOIN users u ON at.created_by = u.id
            ORDER BY at.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('List API tokens error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea token-urilor.' });
    }
}));

// DELETE /api/admin/api-tokens/:id — revoke a token
router.delete('/api-tokens/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `UPDATE api_tokens SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND is_active = true
             RETURNING id, name`,
            [id]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Token negăsit sau deja revocat.' });
            return;
        }

        res.json({ success: true, revoked: rows[0] });
    } catch (err) {
        console.error('Revoke API token error:', err);
        res.status(500).json({ error: 'Eroare la revocarea token-ului.' });
    }
}));

// ==========================================
// ADMIN AVATAR UPLOAD
// ==========================================

// POST /api/admin/users/:id/avatar — upload avatar for any user (stored in PostgreSQL)
router.post('/users/:id/avatar', (req: AuthRequest, res: Response, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Eroare upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'Imaginea este obligatorie.' });
            return;
        }

        // Check user exists
        const { rows: currentUser } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (currentUser.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        // Store avatar binary data in PostgreSQL
        const avatarUrl = `/api/files/avatar/${id}`;

        const { rows } = await pool.query(
            `UPDATE users SET avatar_url = $1, avatar_data = $2, avatar_mime = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING id, email, display_name, avatar_url, departments, role`,
            [avatarUrl, file.buffer, file.mimetype, id]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('Admin avatar upload error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea avatarului.' });
    }
});

export default router;

