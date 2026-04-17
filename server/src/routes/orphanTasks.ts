import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/orphan-tasks — lists active tasks without an assigned_post_id.
 * Available to admin and superadmin (managers don't manage org structure).
 * Used by the Admin triage page to quickly attach posts to legacy tasks.
 */
router.get('/', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(`
        SELECT t.id, t.title, t.status,
               t.department_label,
               to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
               to_char(t.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               t.assigned_to,
               t.created_by,
               uc.display_name AS creator_name,
               uc.avatar_url AS creator_avatar,
               ua.display_name AS assignee_name,
               ua.avatar_url AS assignee_avatar,
               EXISTS (
                   SELECT 1 FROM recurring_tasks rt
                   WHERE rt.template_task_id = t.id AND rt.is_active = true
               ) AS is_recurring_template
        FROM tasks t
        LEFT JOIN users uc ON t.created_by = uc.id
        LEFT JOIN users ua ON t.assigned_to = ua.id
        WHERE t.assigned_post_id IS NULL
          AND t.deleted_at IS NULL
          AND t.status != 'terminat'
        ORDER BY is_recurring_template DESC, t.created_at DESC
    `);

    res.json({ tasks: rows, total: rows.length });
}));

export default router;
