import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

// --- Avatar upload setup (memory storage — we store in DB, not filesystem) ---
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Doar imagini (jpg, png, gif, webp) sunt permise.'));
        }
    }
});

// GET /api/profile — get current user profile
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
        `SELECT id, email, display_name, avatar_url, departments, role, created_at FROM users WHERE id = $1`,
        [req.user!.id]
    );
    if (rows.length === 0) {
        res.status(404).json({ error: 'Utilizator negăsit.' });
        return;
    }
    res.json(rows[0]);
}));

// PATCH /api/profile — update display_name and/or avatar_url
router.patch('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { display_name, avatar_url } = req.body;

    if (!display_name && avatar_url === undefined) {
        res.status(400).json({ error: 'Nimic de actualizat.' });
        return;
    }

    const setParts: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (display_name) {
        if (display_name.trim().length < 2) {
            res.status(400).json({ error: 'Numele trebuie să aibă cel puțin 2 caractere.' });
            return;
        }
        setParts.push(`display_name = $${idx++}`);
        values.push(display_name.trim());
    }

    if (avatar_url !== undefined) {
        // Validate avatar_url: only allow our internal paths or null/empty
        if (avatar_url) {
            const urlStr = String(avatar_url).trim();
            const isValidAvatarPath = /^\/api\/files\/avatar\/[a-f0-9\-]{36}$/i.test(urlStr);
            if (!isValidAvatarPath) {
                res.status(400).json({ error: 'Doar URL-uri interne de avatar sunt permise (/api/files/avatar/{uuid}).' });
                return;
            }
        }
        setParts.push(`avatar_url = $${idx++}`);
        values.push(avatar_url || null);
    }

    setParts.push(`updated_at = NOW()`);
    values.push(req.user!.id);

    const { rows } = await pool.query(
        `UPDATE users SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING id, email, display_name, avatar_url, departments, role`,
        values
    );

    res.json(rows[0]);
}));

// POST /api/profile/avatar — upload avatar image (stored in PostgreSQL)
router.post('/avatar', (req: AuthRequest, res: Response, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Eroare upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'Imaginea este obligatorie.' });
        return;
    }

    // Store avatar binary data in PostgreSQL + set URL to file serving endpoint
    const avatarUrl = `/api/files/avatar/${req.user!.id}`;

    const { rows } = await pool.query(
        `UPDATE users SET avatar_url = $1, avatar_data = $2, avatar_mime = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, display_name, avatar_url, departments, role`,
        [avatarUrl, file.buffer, file.mimetype, req.user!.id]
    );

    res.json(rows[0]);
}));

// DELETE /api/profile/avatar — remove avatar
router.delete('/avatar', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
        `UPDATE users SET avatar_url = NULL, avatar_data = NULL, avatar_mime = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, display_name, avatar_url, departments, role`,
        [req.user!.id]
    );

    res.json(rows[0]);
}));

export default router;
