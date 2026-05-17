import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { asyncHandler } from '../middleware/errorHandler';
import { tError } from '../utils/serverErrors';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/dependencies — both directions
router.get('/dependencies', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }

    const { rows } = await pool.query(`
        SELECT td.*,
            bt.title AS blocking_task_title, bt.status AS blocking_task_status,
            bdt.title AS blocked_task_title, bdt.status AS blocked_task_status,
            u.display_name AS creator_name
        FROM task_dependencies td
        JOIN tasks bt ON td.blocking_task_id = bt.id
        JOIN tasks bdt ON td.blocked_task_id = bdt.id
        JOIN users u ON td.created_by = u.id
        WHERE (td.blocking_task_id = $1 OR td.blocked_task_id = $1)
        ORDER BY td.created_at DESC
    `, [taskId]);

    const blocks = rows.filter(r => r.blocking_task_id === taskId);
    const blocked_by = rows.filter(r => r.blocked_task_id === taskId);

    res.json({ blocks, blocked_by });
}));

// POST /api/tasks/:id/dependencies — add dependency
router.post('/dependencies', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { blocking_task_id, blocked_task_id } = req.body;
    const companyId = req.activeCompanyId;

    if (!blocking_task_id || !blocked_task_id) {
        res.status(400).json({ error: tError(req, 'dependency_tasks_required') });
        return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(blocking_task_id) || !uuidRegex.test(blocked_task_id)) {
        res.status(400).json({ error: tError(req, 'invalid_task_id') });
        return;
    }

    if (blocking_task_id === blocked_task_id) {
        res.status(400).json({ error: tError(req, 'task_cannot_block_self') });
        return;
    }

    // Check access to both tasks (tenant-scoped via 4th param)
    if (!await checkTaskAccess(blocking_task_id, req.user!.id, req.user!.role, companyId) ||
        !await checkTaskAccess(blocked_task_id, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }

    // Check both tasks exist and not deleted — and live in the same active tenant
    const { rows: tasks } = await pool.query(
        `SELECT id, title, assigned_to FROM tasks
         WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND company_id = $2`,
        [[blocking_task_id, blocked_task_id], companyId]
    );
    if (tasks.length < 2) {
        res.status(404).json({ error: tError(req, 'dependency_tasks_missing') });
        return;
    }

    // Circular dependency check via recursive CTE
    // Walk UP from blocking_task_id: if we find blocked_task_id, it's circular
    // Also filter out deleted tasks to avoid false positives from soft-deleted chains
    const { rows: circular } = await pool.query(`
        WITH RECURSIVE dep_chain AS (
            SELECT td.blocking_task_id FROM task_dependencies td
            JOIN tasks t ON td.blocking_task_id = t.id AND t.deleted_at IS NULL
            WHERE td.blocked_task_id = $1
            UNION
            SELECT td.blocking_task_id FROM task_dependencies td
            JOIN tasks t ON td.blocking_task_id = t.id AND t.deleted_at IS NULL
            JOIN dep_chain dc ON td.blocked_task_id = dc.blocking_task_id
        )
        SELECT 1 FROM dep_chain WHERE blocking_task_id = $2 LIMIT 1
    `, [blocking_task_id, blocked_task_id]);

    if (circular.length > 0) {
        res.status(400).json({ error: tError(req, 'circular_dependency') });
        return;
    }

    // Insert dependency
    const { rows: [dep] } = await pool.query(`
        INSERT INTO task_dependencies (blocking_task_id, blocked_task_id, created_by, company_id)
        VALUES ($1, $2, $3, $4) RETURNING *
    `, [blocking_task_id, blocked_task_id, req.user!.id, companyId]);

    const blockingTask = tasks.find(t => t.id === blocking_task_id);
    const blockedTask = tasks.find(t => t.id === blocked_task_id);

    // Activity log on both tasks
    await Promise.all([
        pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
             VALUES ($1, $2, 'dependency_added', $3, $4)`,
            [blocking_task_id, req.user!.id, JSON.stringify({ blocks: blocked_task_id, blocked_task_title: blockedTask?.title }), companyId]
        ),
        pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
             VALUES ($1, $2, 'dependency_added', $3, $4)`,
            [blocked_task_id, req.user!.id, JSON.stringify({ blocked_by: blocking_task_id, blocking_task_title: blockingTask?.title }), companyId]
        ),
    ]);

    // Notification to blocked task assignee
    if (blockedTask?.assigned_to) {
        const payload = {
            actor: req.user!.display_name,
            taskTitle: blockedTask?.title || '',
            blockingTaskTitle: blockingTask?.title || '',
        };
        await pool.query(
            `INSERT INTO notifications (user_id, task_id, type, message, payload, company_id)
             VALUES ($1, $2, 'dependency_added', $3, $4, $5)`,
            [blockedTask.assigned_to, blocked_task_id,
             `„${blockingTask?.title}" acum blochează sarcina ta: „${blockedTask?.title}"`,
             JSON.stringify(payload),
             companyId]
        );
    }

    res.status(201).json(dep);
}));

// DELETE /api/tasks/:id/dependencies/:depId — remove dependency
router.delete('/dependencies/:depId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, depId } = req.params;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Tenant + parent guard: dependency row must reference :taskId AND live in active tenant
    const { rows: depCheck } = await pool.query(
        `SELECT td.* FROM task_dependencies td
         JOIN tasks t ON (t.id = td.blocking_task_id OR t.id = td.blocked_task_id)
         WHERE td.id = $1 AND (td.blocking_task_id = $2 OR td.blocked_task_id = $2)
           AND t.company_id = $3
         LIMIT 1`,
        [depId, taskId, companyId]
    );
    if (depCheck.length === 0) {
        res.status(404).json({ error: tError(req, 'dependency_not_found') });
        return;
    }

    const { rows } = await pool.query(
        `DELETE FROM task_dependencies WHERE id = $1 AND (blocked_task_id = $2 OR blocking_task_id = $2) RETURNING *`,
        [depId, taskId]
    );

    if (rows.length === 0) {
        res.status(404).json({ error: tError(req, 'dependency_not_found') });
        return;
    }

    const dep = rows[0];

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
         VALUES ($1, $2, 'dependency_removed', $3, $4)`,
        [dep.blocking_task_id, req.user!.id, JSON.stringify({ unblocked: dep.blocked_task_id }), companyId]
    );

    res.json({ message: 'Dependența a fost eliminată.' });
}));

export default router;
