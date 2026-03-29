import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// POST /api/tasks/:id/recurring
router.post('/recurring', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;
    const { frequency, workdays_only = false } = req.body;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
        return;
    }

    if (!frequency || !['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].includes(frequency)) {
        res.status(400).json({ error: 'Frecvența este obligatorie (daily, weekly, biweekly, monthly, quarterly, yearly).' });
        return;
    }

    // Get task due date for calculating next run
    const { rows: taskRows } = await pool.query('SELECT due_date FROM tasks WHERE id = $1', [taskId]);
    if (taskRows.length === 0) {
        res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
        return;
    }

    if (!taskRows[0].due_date) {
        res.status(400).json({ error: 'Task-ul must have a due date to enable recurrence.' });
        return;
    }

    let nextRunDate = new Date(taskRows[0].due_date);
    switch (frequency) {
        case 'daily': nextRunDate.setDate(nextRunDate.getDate() + 1); break;
        case 'weekly': nextRunDate.setDate(nextRunDate.getDate() + 7); break;
        case 'biweekly': nextRunDate.setDate(nextRunDate.getDate() + 14); break;
        case 'monthly': nextRunDate.setMonth(nextRunDate.getMonth() + 1); break;
        case 'quarterly': nextRunDate.setMonth(nextRunDate.getMonth() + 3); break;
        case 'yearly': nextRunDate.setFullYear(nextRunDate.getFullYear() + 1); break;
    }

    if (isNaN(nextRunDate.getTime())) {
        res.status(400).json({ error: 'Invalid next run date calculation.' });
        return;
    }

    // Atomic upsert — no race condition between concurrent requests
    const { rows } = await pool.query(`
        INSERT INTO recurring_tasks (template_task_id, frequency, next_run_date, workdays_only, created_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (template_task_id) DO UPDATE SET
            frequency = EXCLUDED.frequency,
            next_run_date = EXCLUDED.next_run_date,
            is_active = true,
            workdays_only = EXCLUDED.workdays_only,
            updated_at = NOW()
        RETURNING *
    `, [taskId, frequency, nextRunDate.toISOString().split('T')[0], workdays_only, req.user!.id]);
    const result = rows[0];

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details)
   VALUES ($1, $2, 'recurring_created', $3)`,
        [taskId, req.user!.id, JSON.stringify({ frequency })]
    );

    res.json(result);
}));

// DELETE /api/tasks/:id/recurring
router.delete('/recurring', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
        return;
    }
    await pool.query(
        `UPDATE recurring_tasks SET is_active = false, updated_at = NOW()
   WHERE template_task_id = $1`,
        [taskId]
    );
    res.json({ message: 'Recurența a fost dezactivată.' });
}));

export default router;
