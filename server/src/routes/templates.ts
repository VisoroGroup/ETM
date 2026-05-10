import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const subtaskSchema = z.object({
    title: z.string().min(1, 'Subtask cím kötelező').max(200, 'Subtask cím max 200 karakter'),
});

const createTemplateSchema = z.object({
    title: z.string().min(1, 'Cím kötelező').max(500),
    description: z.string().max(5000).nullable().optional(),
    department_label: z.string().max(100).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    subtasks: z.array(subtaskSchema).max(50, 'Maximum 50 subtask engedélyezett').optional().default([]),
});

// GET /api/templates — list all templates
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.activeCompanyId;
        if (companyId === undefined) {
            res.status(400).json({ error: 'Companie activă lipsește.' });
            return;
        }
        const result = await pool.query(`
            SELECT t.*,
                u.display_name AS creator_name,
                au.display_name AS assignee_name,
                au.email AS assignee_email
            FROM task_templates t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN users au ON t.assigned_to = au.id
            WHERE t.deleted_at IS NULL
              AND t.company_id = $1
            ORDER BY t.created_at DESC
        `, [companyId]);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates — create template
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.activeCompanyId;
        if (companyId === undefined) {
            res.status(400).json({ error: 'Companie activă lipsește.' });
            return;
        }
        const parsed = createTemplateSchema.parse(req.body);

        const result = await pool.query(`
            INSERT INTO task_templates (title, description, department_label, assigned_to, subtasks, created_by, company_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            parsed.title.trim(),
            parsed.description || null,
            parsed.department_label || 'departament_1',
            parsed.assigned_to || null,
            JSON.stringify(parsed.subtasks),
            req.user?.id,
            companyId
        ]);
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ error: err.errors[0]?.message || 'Validációs hiba' });
            return;
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/templates/:id — delete template
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.activeCompanyId;
        if (companyId === undefined) {
            res.status(400).json({ error: 'Companie activă lipsește.' });
            return;
        }
        const { rows } = await pool.query(
            `UPDATE task_templates SET deleted_at = NOW()
             WHERE id = $1
               AND company_id = $4
               AND (created_by = $2 OR $3 = ANY(ARRAY['admin', 'superadmin']))
               AND deleted_at IS NULL
             RETURNING id`,
            [req.params.id, req.user!.id, req.user!.role, companyId]
        );
        if (rows.length === 0) {
            res.status(404).json({ error: 'Sablon nem található vagy nincs jogosultságod.' });
            return;
        }
        res.status(204).send();
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/templates/:id/use — create a task from template
router.post('/:id/use', authMiddleware, async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: 'Companie activă lipsește.' });
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { due_date } = req.body;

        // Fetch template (scoped to active company)
        const tpl = await client.query(
            'SELECT * FROM task_templates WHERE id = $1 AND company_id = $2',
            [req.params.id, companyId]
        );
        if (!tpl.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sablon negăsit' });
        }
        const t = tpl.rows[0];

        if (!due_date) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Data limită este obligatorie' });
        }

        // Create task
        const taskResult = await client.query(`
            INSERT INTO tasks (title, description, department_label, assigned_to, due_date, created_by, status, company_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'de_rezolvat', $7)
            RETURNING *
        `, [t.title, t.description, t.department_label, t.assigned_to, due_date, req.user?.id, companyId]);
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
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
             VALUES ($1, $2, 'created', $3, $4)`,
            [task.id, req.user!.id, JSON.stringify({ from_template: t.id, template_title: t.title }), companyId]
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
