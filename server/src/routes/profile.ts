import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/profile — get current user profile
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, email, display_name, avatar_url, department, role, created_at FROM users WHERE id = $1`,
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
            `UPDATE users SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING id, email, display_name, avatar_url, department, role`,
            values
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Eroare la actualizarea profilului.' });
    }
});

export default router;
