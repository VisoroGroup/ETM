import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/notifications — get unread notifications for current user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT n.*, u.display_name as created_by_name, u.avatar_url as created_by_avatar,
                   t.title as task_title
            FROM notifications n
            LEFT JOIN users u ON n.created_by = u.id
            LEFT JOIN tasks t ON n.task_id = t.id
            WHERE n.user_id = $1
            ORDER BY n.created_at DESC
            LIMIT 50
        `, [req.user!.id]);
        res.json(rows);
    } catch (err) {
        console.error('Notifications error:', err);
        res.status(500).json({ error: 'Eroare la notificări.' });
    }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
    try {
        const { rows: [{ count }] } = await pool.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
            [req.user!.id]
        );
        res.json({ count: parseInt(count) });
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
});

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user!.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
            [req.user!.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
});

export default router;
