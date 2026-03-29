import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/activity
router.get('/activity', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const userRole = req.user?.role;
        const userId = req.user?.id;

        // Access check: admin/superadmin can see all tasks
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            const { rows: access } = await pool.query(`
                SELECT 1 FROM tasks WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR assigned_to = $2)
                UNION
                SELECT 1 FROM subtasks WHERE task_id = $1 AND assigned_to = $2 AND deleted_at IS NULL
            `, [taskId, userId]);

            if (access.length === 0) {
                res.status(403).json({ error: 'Nincs hozzáférésed ehhez a taskhoz.' });
                return;
            }
        }

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
