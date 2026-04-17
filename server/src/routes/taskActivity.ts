import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/activity
router.get('/activity', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nu ai permisiunea pentru această sarcină.' });
        return;
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const { rows } = await pool.query(
        `SELECT al.*, u.display_name AS user_name, u.avatar_url AS user_avatar
   FROM activity_log al
   JOIN users u ON al.user_id = u.id
   WHERE al.task_id = $1
   ORDER BY al.created_at DESC
   LIMIT $2 OFFSET $3`,
        [taskId, limit, offset]
    );
    res.json(rows);
}));

export default router;
