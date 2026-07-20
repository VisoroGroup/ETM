import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { tError } from '../utils/serverErrors';
import { userIsInCompany, rowIsInCompany } from '../utils/tenantGuard';

const router = Router();

const subtaskSchema = z.object({
    title: z.string().min(1, 'Subtask cím kötelező').max(200, 'Subtask cím max 200 karakter'),
    assigned_to: z.string().uuid().nullable().optional(),
});

const createTemplateSchema = z.object({
    title: z.string().min(1, 'Cím kötelező').max(500),
    description: z.string().max(5000).nullable().optional(),
    department_label: z.string().max(100).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    // Org-aware scope (full-template tenants like Visoro Global). Recurring
    // templates instantiated from the org tree route through the post →
    // section → department head chain — same auto-resolution as for direct
    // task creation. Templates therefore follow the role, not the person.
    assigned_post_id: z.string().uuid().nullable().optional(),
    assigned_section_id: z.string().uuid().nullable().optional(),
    assigned_department_id: z.string().uuid().nullable().optional(),
    subtasks: z.array(subtaskSchema).max(50, 'Maximum 50 subtask engedélyezett').optional().default([]),
});

// GET /api/templates — list all templates
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.activeCompanyId;
        if (companyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
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
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }
        const parsed = createTemplateSchema.parse(req.body);

        // Tenant guards on every UUID. Without these a crafted payload could
        // bind another company's post/section/dept/user into a template
        // owned by the active tenant (audit-3 C9/C13 parity).
        if (parsed.assigned_to && !(await userIsInCompany(parsed.assigned_to, companyId))) {
            return res.status(400).json({ error: tError(req, 'assignee_not_in_company') });
        }
        if (parsed.assigned_post_id && !(await rowIsInCompany('posts', parsed.assigned_post_id, companyId))) {
            return res.status(400).json({ error: tError(req, 'post_not_in_company') });
        }
        if (parsed.assigned_section_id && !(await rowIsInCompany('sections', parsed.assigned_section_id, companyId))) {
            return res.status(400).json({ error: tError(req, 'section_not_in_company') });
        }
        if (parsed.assigned_department_id && !(await rowIsInCompany('departments', parsed.assigned_department_id, companyId))) {
            return res.status(400).json({ error: tError(req, 'department_not_in_company') });
        }

        const result = await pool.query(`
            INSERT INTO task_templates (title, description, department_label, assigned_to,
                                        assigned_post_id, assigned_section_id, assigned_department_id,
                                        subtasks, created_by, company_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            parsed.title.trim(),
            parsed.description || null,
            parsed.department_label || 'departament_1',
            parsed.assigned_to || null,
            parsed.assigned_post_id || null,
            parsed.assigned_section_id || null,
            parsed.assigned_department_id || null,
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
            res.status(400).json({ error: tError(req, 'company_missing') });
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
            res.status(404).json({ error: tError(req, 'template_not_found_or_unauth') });
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
        res.status(400).json({ error: tError(req, 'company_missing') });
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
            return res.status(404).json({ error: tError(req, 'template_not_found') });
        }
        const t = tpl.rows[0];

        if (!due_date) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: tError(req, 'task_due_date_required_alt') });
        }

        // Auto-resolve assignee from the template's scope (post → section
        // head → department head). Mirrors taskService.createTask so a
        // template that targets a *role* (post) re-resolves to whoever
        // currently holds that role, instead of the user who held it when
        // the template was authored.
        let resolvedAssignee: string | null = t.assigned_to || null;
        if (!resolvedAssignee) {
            if (t.assigned_post_id) {
                const { rows: pr } = await client.query(
                    'SELECT user_id FROM posts WHERE id = $1 AND company_id = $2',
                    [t.assigned_post_id, companyId]
                );
                if (pr[0]?.user_id) resolvedAssignee = pr[0].user_id;
            } else if (t.assigned_section_id) {
                const { rows: sr } = await client.query(
                    'SELECT head_user_id FROM sections WHERE id = $1 AND company_id = $2',
                    [t.assigned_section_id, companyId]
                );
                if (sr[0]?.head_user_id) resolvedAssignee = sr[0].head_user_id;
            } else if (t.assigned_department_id) {
                const { rows: dr } = await client.query(
                    'SELECT head_user_id FROM departments WHERE id = $1 AND company_id = $2',
                    [t.assigned_department_id, companyId]
                );
                if (dr[0]?.head_user_id) resolvedAssignee = dr[0].head_user_id;
            }
        }

        // Don't assign the new task to someone who is no longer a member of this
        // company (e.g. the template's stored assignee has since left). Fall back
        // to unassigned so it is re-assigned rather than becoming an invisible,
        // orphaned responsible. Admin/superadmin count as in-company.
        if (resolvedAssignee && !(await userIsInCompany(resolvedAssignee, companyId))) {
            resolvedAssignee = null;
        }

        // Create task — including the org-scope columns so the new task
        // shows the same chips Visoro Global users expect.
        const taskResult = await client.query(`
            INSERT INTO tasks (title, description, department_label, assigned_to,
                               assigned_post_id, assigned_section_id, assigned_department_id,
                               due_date, created_by, status, company_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'de_rezolvat', $10)
            RETURNING *
        `, [t.title, t.description, t.department_label,
            resolvedAssignee,
            t.assigned_post_id || null, t.assigned_section_id || null, t.assigned_department_id || null,
            due_date, req.user?.id, companyId]);
        const task = taskResult.rows[0];

        // Create subtasks — preserve assigned_to from the template if set.
        const subtasks: { title: string; assigned_to?: string | null }[] = t.subtasks || [];
        for (let i = 0; i < subtasks.length; i++) {
            await client.query(`
                INSERT INTO subtasks (task_id, title, assigned_to, order_index, company_id)
                VALUES ($1, $2, $3, $4, $5)
            `, [task.id, subtasks[i].title, subtasks[i].assigned_to || null, i, companyId]);
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
