import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Generates a SQL WHERE clause fragment that limits visibility for 'user' role.
 * Admin and manager see everything; regular users see only:
 * - Tasks they created
 * - Tasks assigned to them
 * - Tasks with subtasks assigned to them
 */
function userScopeFilter(
    user: { id: string; role: string },
    tableAlias: string = 't',
    startParamIndex: number = 1
): { clause: string; values: any[]; nextParamIndex: number } {
    if (user.role === 'superadmin' || user.role === 'admin' || user.role === 'manager') {
        return { clause: '', values: [], nextParamIndex: startParamIndex };
    }
    const p = startParamIndex;
    return {
        clause: `AND (${tableAlias}.created_by = $${p} OR ${tableAlias}.assigned_to = $${p} OR EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = ${tableAlias}.id AND st.assigned_to = $${p}))`,
        values: [user.id],
        nextParamIndex: p + 1,
    };
}

const router = Router();

// GET /api/dashboard/stats — summary numbers
router.get('/stats', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const scope = userScopeFilter(req.user!, 'tasks', 1);
        let p = scope.nextParamIndex;

        const { rows: active } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status IN ('de_rezolvat', 'in_realizare') AND deleted_at IS NULL ${scope.clause}`,
            [...scope.values]
        );

        const { rows: overdue } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE due_date < $${p} AND status NOT IN ('terminat') AND deleted_at IS NULL ${scope.clause}`,
            [...scope.values, today]
        );

        const { rows: blocked } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status = 'blocat' AND deleted_at IS NULL ${scope.clause}`,
            [...scope.values]
        );

        // Completed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { rows: completed } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status = 'terminat'
       AND updated_at >= $${p} AND deleted_at IS NULL ${scope.clause}`,
            [...scope.values, startOfMonth.toISOString()]
        );

        // Total tasks
        const { rows: total } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL ${scope.clause}`,
            [...scope.values]
        );

        res.json({
            active: parseInt(active[0].count, 10),
            overdue: parseInt(overdue[0].count, 10),
            blocked: parseInt(blocked[0].count, 10),
            completed_this_month: parseInt(completed[0].count, 10),
            total: parseInt(total[0].count, 10)
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor.' });
    }
}));

// GET /api/dashboard/charts — chart data
router.get('/charts', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const scope = userScopeFilter(req.user!, 'tasks', 1);

        // Status distribution
        const { rows: statusDist } = await pool.query(
            `SELECT status, COUNT(*) AS count FROM tasks WHERE deleted_at IS NULL ${scope.clause} GROUP BY status ORDER BY status`,
            [...scope.values]
        );

        // Department distribution
        const { rows: deptDist } = await pool.query(
            `SELECT department_label, COUNT(*) AS count FROM tasks
       WHERE status != 'terminat' AND deleted_at IS NULL ${scope.clause}
       GROUP BY department_label ORDER BY department_label`,
            [...scope.values]
        );

        // Completion trend - last 4 weeks
        const scopeT = userScopeFilter(req.user!, 't', 1);
        const { rows: weekRows } = await pool.query(`
            SELECT
                w.week_start::date AS week_start,
                (w.week_start + INTERVAL '6 days')::date AS week_end,
                COUNT(t.id) AS count
            FROM generate_series(
                date_trunc('week', NOW() - INTERVAL '3 weeks'),
                date_trunc('week', NOW()),
                INTERVAL '1 week'
            ) AS w(week_start)
            LEFT JOIN tasks t ON t.status = 'terminat'
                AND t.deleted_at IS NULL
                AND t.updated_at >= w.week_start
                AND t.updated_at < w.week_start + INTERVAL '7 days'
                ${scopeT.clause}
            GROUP BY w.week_start
            ORDER BY w.week_start ASC
        `, [...scopeT.values]);

        const weeks = weekRows.map((row, i) => ({
            week_start: typeof row.week_start === 'string' ? row.week_start : row.week_start.toISOString().split('T')[0],
            week_end: typeof row.week_end === 'string' ? row.week_end : row.week_end.toISOString().split('T')[0],
            count: parseInt(row.count, 10),
            label: `Săpt. ${i + 1}`
        }));

        // Urgent tasks - top 10 upcoming (not completed)
        const scopeU = userScopeFilter(req.user!, 't', 1);
        const { rows: urgent } = await pool.query(
            `SELECT t.*, u.display_name AS creator_name, u.avatar_url AS creator_avatar,
        COALESCE(sub.total, 0) AS subtask_total,
        COALESCE(sub.completed, 0) AS subtask_completed
       FROM tasks t
       JOIN users u ON t.created_by = u.id
       LEFT JOIN (
         SELECT task_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_completed = true) AS completed
         FROM subtasks WHERE deleted_at IS NULL GROUP BY task_id
       ) sub ON sub.task_id = t.id
       WHERE t.status != 'terminat' AND t.deleted_at IS NULL ${scopeU.clause}
       ORDER BY t.due_date ASC
       LIMIT 10`,
            [...scopeU.values]
        );

        res.json({
            status_distribution: statusDist,
            department_distribution: deptDist,
            completion_trend: weeks,
            urgent_tasks: urgent
        });
    } catch (err) {
        console.error('Dashboard charts error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea graficelor.' });
    }
}));

// GET /api/dashboard/active-alerts — all unresolved alerts across tasks
router.get('/active-alerts', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const scope = userScopeFilter(req.user!, 't', 1);
        const { rows } = await pool.query(
            `SELECT a.id, a.task_id, a.content, a.created_at,
                    t.title AS task_title, t.status AS task_status, t.department_label,
                    u.display_name AS creator_name, u.avatar_url AS creator_avatar
             FROM task_alerts a
             JOIN tasks t ON a.task_id = t.id
             JOIN users u ON a.created_by = u.id
             WHERE a.is_resolved = false AND t.deleted_at IS NULL AND t.status != 'terminat' ${scope.clause}
             ORDER BY a.created_at DESC
             LIMIT 20`,
            [...scope.values]
        );
        res.json(rows);
    } catch (err) {
        console.error('Active alerts error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea alertelor active.' });
    }
}));

// GET /api/dashboard/my-stats — user-specific stats
router.get('/my-stats', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const today = new Date().toISOString().split('T')[0];

        // My assigned tasks (active)
        const { rows: myActive } = await pool.query(
            `SELECT COUNT(*) FROM tasks
             WHERE assigned_to = $1 AND status IN ('de_rezolvat', 'in_realizare') AND deleted_at IS NULL`,
            [userId]
        );

        // My overdue tasks
        const { rows: myOverdue } = await pool.query(
            `SELECT COUNT(*) FROM tasks
             WHERE assigned_to = $1 AND due_date < $2 AND status NOT IN ('terminat') AND deleted_at IS NULL`,
            [userId, today]
        );

        // My pending subtasks
        const { rows: mySubtasks } = await pool.query(
            `SELECT COUNT(*) FROM subtasks s
             JOIN tasks t ON s.task_id = t.id
             WHERE s.assigned_to = $1 AND s.is_completed = false
               AND t.deleted_at IS NULL AND (s.deleted_at IS NULL)`,
            [userId]
        );

        // My tasks completed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { rows: myCompleted } = await pool.query(
            `SELECT COUNT(*) FROM tasks
             WHERE assigned_to = $1 AND status = 'terminat'
               AND updated_at >= $2 AND deleted_at IS NULL`,
            [userId, startOfMonth.toISOString()]
        );

        // My upcoming tasks (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const { rows: upcoming } = await pool.query(
            `SELECT t.id, t.title, t.due_date, t.status, t.department_label
             FROM tasks t
             WHERE t.assigned_to = $1
               AND t.due_date BETWEEN $2 AND $3
               AND t.status NOT IN ('terminat')
               AND t.deleted_at IS NULL
             ORDER BY t.due_date ASC LIMIT 5`,
            [userId, today, nextWeek.toISOString().split('T')[0]]
        );

        res.json({
            my_active: parseInt(myActive[0].count, 10),
            my_overdue: parseInt(myOverdue[0].count, 10),
            my_pending_subtasks: parseInt(mySubtasks[0].count, 10),
            my_completed_this_month: parseInt(myCompleted[0].count, 10),
            upcoming_tasks: upcoming,
        });
    } catch (err) {
        console.error('My stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor personale.' });
    }
}));

// GET /api/dashboard/bottlenecks — top tasks blocking the most others
router.get('/bottlenecks', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const scope = userScopeFilter(req.user!, 't', 1);
        const { rows } = await pool.query(`
            SELECT t.id, t.title, t.status, t.department_label, t.assigned_to,
                   u.display_name AS assignee_name,
                   COUNT(td.blocked_task_id) AS blocks_count
            FROM tasks t
            JOIN task_dependencies td ON td.blocking_task_id = t.id
            JOIN tasks bt ON td.blocked_task_id = bt.id AND bt.status != 'terminat' AND bt.deleted_at IS NULL
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.status != 'terminat' AND t.deleted_at IS NULL ${scope.clause}
            GROUP BY t.id, t.title, t.status, t.department_label, t.assigned_to, u.display_name
            ORDER BY blocks_count DESC
            LIMIT 5
        `, [...scope.values]);
        res.json(rows);
    } catch (err) {
        console.error('Bottlenecks error:', err);
        res.status(500).json({ error: 'Eroare la bottlenecks.' });
    }
}));

// --- Dashboard Preferences (widget layout) ---

const DEFAULT_LAYOUTS: Record<string, any[]> = {
    admin: [
        { widget_id: 'global_stats', visible: true, order: 0, size: 'full' },
        { widget_id: 'my_stats', visible: true, order: 1, size: 'full' },
        { widget_id: 'status_chart', visible: true, order: 2, size: 'half' },
        { widget_id: 'dept_chart', visible: true, order: 3, size: 'half' },
        { widget_id: 'trend_chart', visible: true, order: 4, size: 'full' },
        { widget_id: 'urgent_tasks', visible: true, order: 5, size: 'full' },
        { widget_id: 'active_alerts', visible: true, order: 6, size: 'full' },
        { widget_id: 'bottlenecks', visible: true, order: 7, size: 'full' },
        { widget_id: 'payment_summary', visible: true, order: 8, size: 'full' },
        { widget_id: 'calendar', visible: false, order: 9, size: 'full' },
    ],
    manager: [
        { widget_id: 'global_stats', visible: true, order: 0, size: 'full' },
        { widget_id: 'my_stats', visible: true, order: 1, size: 'full' },
        { widget_id: 'dept_chart', visible: true, order: 2, size: 'full' },
        { widget_id: 'urgent_tasks', visible: true, order: 3, size: 'full' },
        { widget_id: 'active_alerts', visible: true, order: 4, size: 'full' },
        { widget_id: 'bottlenecks', visible: true, order: 5, size: 'full' },
        { widget_id: 'status_chart', visible: false, order: 6, size: 'half' },
        { widget_id: 'trend_chart', visible: false, order: 7, size: 'full' },
        { widget_id: 'payment_summary', visible: false, order: 8, size: 'full' },
        { widget_id: 'calendar', visible: false, order: 9, size: 'full' },
    ],
    user: [
        { widget_id: 'my_stats', visible: true, order: 0, size: 'full' },
        { widget_id: 'urgent_tasks', visible: true, order: 1, size: 'full' },
        { widget_id: 'calendar', visible: true, order: 2, size: 'full' },
        { widget_id: 'active_alerts', visible: true, order: 3, size: 'full' },
        { widget_id: 'global_stats', visible: false, order: 4, size: 'full' },
        { widget_id: 'status_chart', visible: false, order: 5, size: 'half' },
        { widget_id: 'dept_chart', visible: false, order: 6, size: 'half' },
        { widget_id: 'trend_chart', visible: false, order: 7, size: 'full' },
        { widget_id: 'bottlenecks', visible: false, order: 8, size: 'full' },
        { widget_id: 'payment_summary', visible: false, order: 9, size: 'full' },
    ],
};

// GET /api/dashboard/preferences
router.get('/preferences', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(
            'SELECT widget_layout FROM dashboard_preferences WHERE user_id = $1', [req.user!.id]
        );
        if (rows.length > 0) {
            res.json(rows[0].widget_layout);
        } else {
            const role = req.user!.role || 'user';
            res.json(DEFAULT_LAYOUTS[role] || DEFAULT_LAYOUTS.user);
        }
    } catch (err) {
        console.error('Preferences error:', err);
        res.status(500).json({ error: 'Eroare la preferințe.' });
    }
}));

// PUT /api/dashboard/preferences
router.put('/preferences', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { widget_layout } = req.body;
        if (!Array.isArray(widget_layout)) {
            res.status(400).json({ error: 'widget_layout trebuie să fie un array.' });
            return;
        }
        await pool.query(
            `INSERT INTO dashboard_preferences (user_id, widget_layout, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET widget_layout = $2, updated_at = NOW()`,
            [req.user!.id, JSON.stringify(widget_layout)]
        );
        res.json({ message: 'Preferințe salvate.' });
    } catch (err) {
        console.error('Save preferences error:', err);
        res.status(500).json({ error: 'Eroare la salvare.' });
    }
}));

// GET /api/dashboard/calendar-events — tasks + subtasks with due_date for calendar
router.get('/calendar-events', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const scope = userScopeFilter(req.user!, 't', 1);

        // Tasks with due_date
        const { rows: tasks } = await pool.query(`
            SELECT t.id, t.title, t.due_date, t.status, t.department_label, t.assigned_to,
                   u.display_name AS assignee_name,
                   'task' AS event_type, NULL AS parent_task_id, NULL AS parent_task_title
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.due_date IS NOT NULL AND t.deleted_at IS NULL AND t.status != 'terminat' ${scope.clause}
            ORDER BY t.due_date ASC
        `, [...scope.values]);

        // Subtasks with due_date (from non-deleted parent tasks)
        const { rows: subtasks } = await pool.query(`
            SELECT s.id, s.title, s.due_date, 
                   CASE WHEN s.is_completed THEN 'terminat' ELSE 'de_rezolvat' END AS status,
                   t.department_label, s.assigned_to,
                   u.display_name AS assignee_name,
                   'subtask' AS event_type, t.id AS parent_task_id, t.title AS parent_task_title
            FROM subtasks s
            JOIN tasks t ON s.task_id = t.id
            LEFT JOIN users u ON s.assigned_to = u.id
            WHERE s.due_date IS NOT NULL AND s.is_completed = false
              AND (s.deleted_at IS NULL) AND t.deleted_at IS NULL AND t.status != 'terminat' ${scope.clause}
            ORDER BY s.due_date ASC
        `, [...scope.values]);

        res.json([...tasks, ...subtasks]);
    } catch (err) {
        console.error('Calendar events error:', err);
        res.status(500).json({ error: 'Eroare la evenimentele calendarului.' });
    }
}));

export default router;
