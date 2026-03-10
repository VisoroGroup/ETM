import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/stats — summary numbers
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { rows: active } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status IN ('de_rezolvat', 'in_realizare')`
        );

        const { rows: overdue } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE due_date < $1 AND status NOT IN ('terminat')`,
            [today]
        );

        const { rows: blocked } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status = 'blocat'`
        );

        // Completed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { rows: completed } = await pool.query(
            `SELECT COUNT(*) FROM tasks WHERE status = 'terminat'
       AND updated_at >= $1`,
            [startOfMonth.toISOString()]
        );

        // Total tasks
        const { rows: total } = await pool.query(`SELECT COUNT(*) FROM tasks`);

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
            `SELECT status, COUNT(*) AS count FROM tasks GROUP BY status ORDER BY status`
        );

        // Department distribution
        const { rows: deptDist } = await pool.query(
            `SELECT department_label, COUNT(*) AS count FROM tasks
       WHERE status != 'terminat'
       GROUP BY department_label ORDER BY department_label`
        );

        // Completion trend - last 4 weeks
        const weeks = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1 - (i * 7));
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const { rows } = await pool.query(
                `SELECT COUNT(*) FROM tasks
         WHERE status = 'terminat'
         AND updated_at BETWEEN $1 AND $2`,
                [weekStart.toISOString(), weekEnd.toISOString()]
            );

            weeks.push({
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                count: parseInt(rows[0].count),
                label: `Săpt. ${4 - i}`
            });
        }

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
         FROM subtasks GROUP BY task_id
       ) sub ON sub.task_id = t.id
       WHERE t.status != 'terminat'
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

export default router;
