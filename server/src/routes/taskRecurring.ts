import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/tasks/:id/recurring
router.post('/recurring', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { frequency, workdays_only = false } = req.body;

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

        let nextRunDate = new Date(taskRows[0].due_date);
        switch (frequency) {
            case 'daily': nextRunDate.setDate(nextRunDate.getDate() + 1); break;
            case 'weekly': nextRunDate.setDate(nextRunDate.getDate() + 7); break;
            case 'biweekly': nextRunDate.setDate(nextRunDate.getDate() + 14); break;
            case 'monthly': nextRunDate.setMonth(nextRunDate.getMonth() + 1); break;
            case 'quarterly': nextRunDate.setMonth(nextRunDate.getMonth() + 3); break;
            case 'yearly': nextRunDate.setFullYear(nextRunDate.getFullYear() + 1); break;
        }

        // Check if recurring already exists
        const { rows: existing } = await pool.query(
            'SELECT id FROM recurring_tasks WHERE template_task_id = $1', [taskId]
        );

        let result;
        if (existing.length > 0) {
            const { rows } = await pool.query(
                `UPDATE recurring_tasks SET frequency = $1, next_run_date = $2, is_active = true, workdays_only = $3, updated_at = NOW()
         WHERE template_task_id = $4 RETURNING *`,
                [frequency, nextRunDate.toISOString().split('T')[0], workdays_only, taskId]
            );
            result = rows[0];
        } else {
            const { rows } = await pool.query(
                `INSERT INTO recurring_tasks (template_task_id, frequency, next_run_date, workdays_only, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [taskId, frequency, nextRunDate.toISOString().split('T')[0], workdays_only, req.user!.id]
            );
            result = rows[0];
        }

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'recurring_created', $3)`,
            [taskId, req.user!.id, JSON.stringify({ frequency })]
        );

        res.json(result);
    } catch (err) {
        console.error('Error setting recurring:', err);
        res.status(500).json({ error: 'Eroare la setarea recurenței.' });
    }
});

// DELETE /api/tasks/:id/recurring
router.delete('/recurring', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        await pool.query(
            `UPDATE recurring_tasks SET is_active = false, updated_at = NOW()
       WHERE template_task_id = $1`,
            [taskId]
        );
        res.json({ message: 'Recurența a fost dezactivată.' });
    } catch (err) {
        res.status(500).json({ error: 'Eroare la dezactivarea recurenței.' });
    }
});

export default router;
