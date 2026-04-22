import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/notifications — get unread notifications for current user
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
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
}));

// GET /api/notifications/unread-count
router.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { rows: [{ count }] } = await pool.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
            [req.user!.id]
        );
        res.json({ count: parseInt(count, 10) });
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
}));

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user!.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
}));

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
            [req.user!.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
}));

// PATCH /api/notifications/read-for-task/:taskId
// Body: { types: string[] } — only notifications whose `type` is in the list
// are marked read. Used when a user opens a task drawer / switches to a tab:
// that action proves they saw the corresponding notification type.
router.patch('/read-for-task/:taskId', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;
    const types = Array.isArray(req.body?.types) ? req.body.types : [];

    if (types.length === 0) {
        res.status(400).json({ error: 'types array is required.' });
        return;
    }

    try {
        const { rowCount } = await pool.query(
            `UPDATE notifications
                SET is_read = true
              WHERE user_id = $1
                AND task_id = $2
                AND type = ANY($3::text[])
                AND is_read = false`,
            [req.user!.id, taskId, types]
        );
        res.json({ success: true, updated: rowCount ?? 0 });
    } catch (err) {
        console.error('read-for-task error:', err);
        res.status(500).json({ error: 'Eroare.' });
    }
}));

export default router;
