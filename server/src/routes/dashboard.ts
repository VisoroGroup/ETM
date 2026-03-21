import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/stats — summary numbers
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { rows: active } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status IN ('de_rezolvat', 'in_realizare') AND deleted_at IS NULL`
        );

        const { rows: overdue } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE due_date < $1 AND status NOT IN ('terminat') AND deleted_at IS NULL`,
            [today]
        );

        const { rows: blocked } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status = 'blocat' AND deleted_at IS NULL`
        );

        // Completed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { rows: completed } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status = 'terminat'
       AND updated_at >= $1 AND deleted_at IS NULL`,
            [startOfMonth.toISOString()]
        );

        // Total tasks
        const { rows: total } = await pool.query(`SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL`);

        res.json({
            active: parseInt(active[0].count),
            overdue: parseInt(overdue[0].count),
            blocked: parseInt(blocked[0].count),
            completed_this_month: parseInt(completed[0].count),
            total: parseInt(total[0].count)
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor.' });
    }
});

// GET /api/dashboard/charts — chart data
router.get('/charts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        // Status distribution
        const { rows: statusDist } = await pool.query(
            `SELECT status, COUNT(*) AS count FROM tasks WHERE deleted_at IS NULL GROUP BY status ORDER BY status`
        );

        // Department distribution
        const { rows: deptDist } = await pool.query(
            `SELECT department_label, COUNT(*) AS count FROM tasks
       WHERE status != 'terminat' AND deleted_at IS NULL
       GROUP BY department_label ORDER BY department_label`
        );

        // Completion trend - last 4 weeks (single query instead of 4)
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
            GROUP BY w.week_start
            ORDER BY w.week_start ASC
        `);

        const weeks = weekRows.map((row, i) => ({
            week_start: row.week_start.toISOString().split('T')[0],
            week_end: row.week_end.toISOString().split('T')[0],
            count: parseInt(row.count),
            label: `Săpt. ${i + 1}`
        }));

        // Urgent tasks - top 10 upcoming (not completed)
        const today = new Date().toISOString().split('T')[0];
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
       WHERE t.status != 'terminat' AND t.deleted_at IS NULL
       ORDER BY t.due_date ASC
       LIMIT 10`
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
});

// GET /api/dashboard/active-alerts — all unresolved alerts across tasks
router.get('/active-alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT a.id, a.task_id, a.content, a.created_at,
                    t.title AS task_title, t.status AS task_status, t.department_label,
                    u.display_name AS creator_name, u.avatar_url AS creator_avatar
             FROM task_alerts a
             JOIN tasks t ON a.task_id = t.id
             JOIN users u ON a.created_by = u.id
             WHERE a.is_resolved = false AND t.deleted_at IS NULL AND t.status != 'terminat'
             ORDER BY a.created_at DESC
             LIMIT 20`
        );
        res.json(rows);
    } catch (err) {
        console.error('Active alerts error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea alertelor active.' });
    }
});

// GET /api/dashboard/my-stats — user-specific stats
router.get('/my-stats', authMiddleware, async (req: AuthRequest, res: Response) => {
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
            my_active: parseInt(myActive[0].count),
            my_overdue: parseInt(myOverdue[0].count),
            my_pending_subtasks: parseInt(mySubtasks[0].count),
            my_completed_this_month: parseInt(myCompleted[0].count),
            upcoming_tasks: upcoming,
        });
    } catch (err) {
        console.error('My stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor personale.' });
    }
});

export default router;
