import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/user-preferences — get current user's preferences
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
        'SELECT preferences FROM user_preferences WHERE user_id = $1',
        [req.user!.id]
    );
    res.json(rows[0]?.preferences ?? {});
}));

// PUT /api/user-preferences — upsert (merge-patch) preferences
router.put('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const patch = req.body;
    if (!patch || typeof patch !== 'object') {
        res.status(400).json({ error: 'Body must be a JSON object.' });
        return;
    }

    const { rows } = await pool.query(
        `INSERT INTO user_preferences (user_id, preferences)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET preferences = user_preferences.preferences || $2, updated_at = NOW()
         RETURNING preferences`,
        [req.user!.id, JSON.stringify(patch)]
    );
    res.json(rows[0].preferences);
}));

export default router;
