import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/templates — list all templates
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT t.*,
                u.display_name AS creator_name,
                au.display_name AS assignee_name,
                au.email AS assignee_email
            FROM task_templates t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN users au ON t.assigned_to = au.id
            WHERE t.deleted_at IS NULL
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates — create template
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, department_label, assigned_to, subtasks } = req.body;
        if (!title?.trim()) return res.status(400).json({ error: 'Titlul este obligatoriu' });

        const result = await pool.query(`
            INSERT INTO task_templates (title, description, department_label, assigned_to, subtasks, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            title.trim(),
            description || null,
            department_label || 'departament_1',
            assigned_to || null,
            JSON.stringify(subtasks || []),
            req.user?.id
        ]);
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/templates/:id — delete template
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        await pool.query('UPDATE task_templates SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates/:id/use — create a task from template
router.post('/:id/use', authMiddleware, async (req: AuthRequest, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { due_date } = req.body;

        // Fetch template
        const tpl = await client.query('SELECT * FROM task_templates WHERE id = $1', [req.params.id]);
        if (!tpl.rows[0]) return res.status(404).json({ error: 'Sablon negăsit' });
        const t = tpl.rows[0];

        if (!due_date) return res.status(400).json({ error: 'Data limită este obligatorie' });

        // Create task
        const taskResult = await client.query(`
            INSERT INTO tasks (title, description, department_label, assigned_to, due_date, created_by, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'de_rezolvat')
            RETURNING *
        `, [t.title, t.description, t.department_label, t.assigned_to, due_date, req.user?.id]);
        const task = taskResult.rows[0];

        // Create subtasks
        const subtasks: { title: string }[] = t.subtasks || [];
        for (let i = 0; i < subtasks.length; i++) {
            await client.query(`
                INSERT INTO subtasks (task_id, title, order_index)
                VALUES ($1, $2, $3)
            `, [task.id, subtasks[i].title, i]);
        }

        // Activity log
        await client.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
             VALUES ($1, $2, 'created', $3)`,
            [task.id, req.user!.id, JSON.stringify({ from_template: t.id, template_title: t.title })]
        );

        await client.query('COMMIT');
        res.status(201).json(task);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

export default router;
