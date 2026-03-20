import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/activity
router.get('/activity', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { rows } = await pool.query(
            `SELECT al.*, u.display_name AS user_name, u.avatar_url AS user_avatar
       FROM activity_log al
       JOIN users u ON al.user_id = u.id
       WHERE al.task_id = $1
       ORDER BY al.created_at DESC`,
            [taskId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la încărcarea activității.' });
    }
});

export default router;
