import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/dependencies — both directions
router.get('/dependencies', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id;

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

    if (!blocking_task_id || !blocked_task_id) {
        res.status(400).json({ error: 'blocking_task_id și blocked_task_id sunt obligatorii.' });
        return;
    }

    if (blocking_task_id === blocked_task_id) {
        res.status(400).json({ error: 'Un task nu se poate bloca pe sine.' });
        return;
    }

    // Check both tasks exist and not deleted
    const { rows: tasks } = await pool.query(
        `SELECT id, title, assigned_to FROM tasks WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [[blocking_task_id, blocked_task_id]]
    );
    if (tasks.length < 2) {
        res.status(404).json({ error: 'Unul sau ambele task-uri nu au fost găsite.' });
        return;
    }

    // Circular dependency check via recursive CTE
    // Walk UP from blocking_task_id: if we find blocked_task_id, it's circular
    const { rows: circular } = await pool.query(`
        WITH RECURSIVE dep_chain AS (
            SELECT blocking_task_id FROM task_dependencies WHERE blocked_task_id = $1
            UNION
            SELECT td.blocking_task_id FROM task_dependencies td
            JOIN dep_chain dc ON td.blocked_task_id = dc.blocking_task_id
        )
        SELECT 1 FROM dep_chain WHERE blocking_task_id = $2 LIMIT 1
    `, [blocking_task_id, blocked_task_id]);

    if (circular.length > 0) {
        res.status(400).json({ error: 'Nu se poate adăuga — ar crea o dependență circulară!' });
        return;
    }

    // Insert dependency
    const { rows: [dep] } = await pool.query(`
        INSERT INTO task_dependencies (blocking_task_id, blocked_task_id, created_by)
        VALUES ($1, $2, $3) RETURNING *
    `, [blocking_task_id, blocked_task_id, req.user!.id]);

    const blockingTask = tasks.find(t => t.id === blocking_task_id);
    const blockedTask = tasks.find(t => t.id === blocked_task_id);

    // Activity log on both tasks
    await Promise.all([
        pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
             VALUES ($1, $2, 'dependency_added', $3)`,
            [blocking_task_id, req.user!.id, JSON.stringify({ blocks: blocked_task_id, blocked_task_title: blockedTask?.title })]
        ),
        pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
             VALUES ($1, $2, 'dependency_added', $3)`,
            [blocked_task_id, req.user!.id, JSON.stringify({ blocked_by: blocking_task_id, blocking_task_title: blockingTask?.title })]
        ),
    ]);

    // Notification to blocked task assignee
    if (blockedTask?.assigned_to) {
        await pool.query(
            `INSERT INTO notifications (user_id, task_id, type, message)
             VALUES ($1, $2, 'dependency_added', $3)`,
            [blockedTask.assigned_to, blocked_task_id,
             `„${blockingTask?.title}" acum blochează sarcina ta: „${blockedTask?.title}"`]
        );
    }

    res.status(201).json(dep);
}));

// DELETE /api/tasks/:id/dependencies/:depId — remove dependency
router.delete('/dependencies/:depId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { depId } = req.params;

    const { rows } = await pool.query(
        `DELETE FROM task_dependencies WHERE id = $1 RETURNING *`,
        [depId]
    );

    if (rows.length === 0) {
        res.status(404).json({ error: 'Dependența nu a fost găsită.' });
        return;
    }

    const dep = rows[0];

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details)
         VALUES ($1, $2, 'dependency_removed', $3)`,
        [dep.blocking_task_id, req.user!.id, JSON.stringify({ unblocked: dep.blocked_task_id })]
    );

    res.json({ message: 'Dependența a fost eliminată.' });
}));

export default router;
