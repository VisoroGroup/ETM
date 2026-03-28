import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// --- Avatar upload setup ---
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const avatarDir = path.join(uploadDir, 'avatars');
if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
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
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, email, display_name, avatar_url, departments, role, created_at FROM users WHERE id = $1`,
            [req.user!.id]
        );
        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la profil.' });
    }
});

// PATCH /api/profile — update display_name and/or avatar_url
router.patch('/', async (req: AuthRequest, res: Response) => {
    const { display_name, avatar_url } = req.body;

    if (!display_name && avatar_url === undefined) {
        res.status(400).json({ error: 'Nimic de actualizat.' });
        return;
    }

    try {
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
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Eroare la actualizarea profilului.' });
    }
});

// POST /api/profile/avatar — upload avatar image
router.post('/avatar', (req: AuthRequest, res: Response, next) => {
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
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'Imaginea este obligatorie.' });
            return;
        }

        // Delete old avatar file if exists
        const { rows: currentUser } = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.user!.id]);
        if (currentUser[0]?.avatar_url && currentUser[0].avatar_url.startsWith('/uploads/avatars/')) {
            try {
                const oldPath = path.join(uploadDir, 'avatars', path.basename(currentUser[0].avatar_url));
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            } catch {}
        }

        const avatarUrl = `/uploads/avatars/${file.filename}`;

        const { rows } = await pool.query(
            `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, display_name, avatar_url, departments, role`,
            [avatarUrl, req.user!.id]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea avatarului.' });
    }
});

// DELETE /api/profile/avatar — remove avatar
router.delete('/avatar', async (req: AuthRequest, res: Response) => {
    try {
        const { rows: currentUser } = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.user!.id]);
        if (currentUser[0]?.avatar_url && currentUser[0].avatar_url.startsWith('/uploads/avatars/')) {
            try {
                const oldPath = path.join(uploadDir, 'avatars', path.basename(currentUser[0].avatar_url));
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            } catch {}
        }

        const { rows } = await pool.query(
            `UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING id, email, display_name, avatar_url, departments, role`,
            [req.user!.id]
        );

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la ștergerea avatarului.' });
    }
});

export default router;
