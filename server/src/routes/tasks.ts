import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus } from '../types';
import { validateCreateTask, validateUpdateTask, validateChangeStatus } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { checkTaskAccess } from '../middleware/taskAccess';
import * as taskService from '../services/taskService';
import { dispatchWebhook } from '../services/webhookService';
import { getTaskStakeholders, buildNotificationHtml, sendNotificationEmail, resolveRecipientLocale } from '../services/notificationEmailService';
import { tServer } from '../i18n/serverI18n';
import { getCompletionReportRecipients, buildCompletionReportHtml } from '../services/taskCompletionReportService';
import { todayLocal, toLocalDateStr, getDayOfWeek } from '../utils/dateUtils';
import { rollForwardToWorkday } from '../utils/workdays';
import { userIsInCompany, rowIsInCompany } from '../utils/tenantGuard';
import taskSubtaskRoutes from './taskSubtasks';
import taskCommentRoutes from './taskComments';
import taskAttachmentRoutes from './taskAttachments';
import taskActivityRoutes from './taskActivity';
import taskRecurringRoutes from './taskRecurring';
import taskAlertRoutes from './taskAlerts';
import taskDependencyRoutes from './taskDependencies';
import taskChecklistRoutes from './taskChecklist';
import { tError } from '../utils/serverErrors';

const router = Router();

// GET /api/tasks — list tasks with filters
router.get('/', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
        const {
            status,
            department,
            search,
            period,
            recurring,
            assigned_to,
            my_tasks,
            assigned_to_me,
            created_by_me,
            exclude_status,
            pug_project_id,
            page = '1',
            limit = '50'
        } = req.query;

        if (req.activeCompanyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }

        const conditions: string[] = ['t.deleted_at IS NULL'];
        const values: any[] = [];
        let paramIndex = 1;

        // Multi-tenant scoping: only show tasks belonging to the active company
        conditions.push(`t.company_id = $${paramIndex++}`);
        values.push(req.activeCompanyId);

        // Status filter (multi-select, comma separated)
        if (status) {
            const statuses = (status as string).split(',');
            conditions.push(`t.status = ANY($${paramIndex++})`);
            values.push(statuses);
        }

        // Exclude status (e.g. exclude_status=terminat)
        if (exclude_status) {
            conditions.push(`t.status != $${paramIndex++}`);
            values.push(exclude_status as string);
        }

        // Department filter (multi-select, comma separated)
        if (department) {
            const depts = (department as string).split(',');
            conditions.push(`t.department_label = ANY($${paramIndex++})`);
            values.push(depts);
        }

        // PUG project filter — used by ProjectDetailPage to list tasks
        // attached to a specific project. Pass `pug_project_id=null` (literal
        // string) to filter for unlinked tasks.
        if (pug_project_id) {
            if (pug_project_id === 'null') {
                conditions.push(`t.pug_project_id IS NULL`);
            } else {
                conditions.push(`t.pug_project_id = $${paramIndex++}`);
                values.push(pug_project_id);
            }
        }

        // Full-text search — tsvector (GIN index) + ILIKE prefix fallback for short queries
        if (search) {
            const q = (search as string).trim();
            if (q.length === 1) {
                // Single character — use ILIKE prefix (tsvector minimum is 2 chars)
                conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
                values.push(`${q}%`);
                paramIndex++;
            } else {
                // Full-text search: match on tsvector + also search comments via ILIKE
                conditions.push(`(
                    t.search_vector @@ plainto_tsquery('simple', $${paramIndex})
                    OR t.title ILIKE $${paramIndex + 1}
                    OR EXISTS (SELECT 1 FROM task_comments tc WHERE tc.task_id = t.id AND tc.content ILIKE $${paramIndex + 1})
                )`);
                values.push(q, `%${q}%`);
                paramIndex += 2;
            }
        }

        // Period filter
        if (period) {
            const today = todayLocal();
            switch (period) {
                case 'today':
                    conditions.push(`t.due_date = $${paramIndex++}`);
                    values.push(today);
                    break;
                case 'this_week': {
                    const now = new Date();
                    const endOfWeek = new Date(now);
                    endOfWeek.setDate(now.getDate() + (7 - getDayOfWeek(now)));
                    conditions.push(`t.due_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
                    values.push(today, toLocalDateStr(endOfWeek));
                    paramIndex += 2;
                    break;
                }
                case 'this_month': {
                    const now = new Date();
                    const endOfMonth = new Date(now);
                    endOfMonth.setMonth(now.getMonth() + 1, 0);
                    conditions.push(`t.due_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
                    values.push(today, toLocalDateStr(endOfMonth));
                    paramIndex += 2;
                    break;
                }
                case 'overdue':
                    conditions.push(`t.due_date < $${paramIndex} AND t.status != 'terminat'`);
                    values.push(today);
                    paramIndex++;
                    break;
            }
        }

        // Recurring filter
        if (recurring === 'true') {
            conditions.push(`EXISTS (SELECT 1 FROM recurring_tasks rt WHERE rt.template_task_id = t.id AND rt.is_active = true)`);
        } else if (recurring === 'false') {
            conditions.push(`NOT EXISTS (SELECT 1 FROM recurring_tasks rt WHERE rt.template_task_id = t.id AND rt.is_active = true)`);
        }

        // Assigned to filter (subtask assignee)
        if (assigned_to) {
            conditions.push(`EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $${paramIndex++})`);
            values.push(assigned_to);
        }

        // My tasks filter — anything the current user is involved in
        // (creator, assignee, or a subtask assignee)
        if (my_tasks === 'true') {
            conditions.push(`(
                t.created_by = $${paramIndex}
                OR t.assigned_to = $${paramIndex}
                OR EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $${paramIndex})
            )`);
            values.push(req.user!.id);
            paramIndex++;
        }

        // Assigned-to-me filter (Bug 1): strictly the user's own assignments
        // ("Atribuite mie" toggle), NOT the old "involved in anything" semantics.
        if (assigned_to_me === 'true') {
            conditions.push(`t.assigned_to = $${paramIndex++}`);
            values.push(req.user!.id);
        }

        // Created-by-me filter (Bug 1): tasks the user created ("Create de mine" toggle).
        if (created_by_me === 'true') {
            conditions.push(`t.created_by = $${paramIndex++}`);
            values.push(req.user!.id);
        }

        // TEAM-BASED VIEW: regular 'user' role sees only tasks they created, are assigned to, or have subtasks assigned to them
        if (req.user?.role === 'user') {
            conditions.push(`(
                t.created_by = $${paramIndex} OR
                t.assigned_to = $${paramIndex} OR
                EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $${paramIndex})
            )`);
            values.push(req.user.id);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        // Main query with aggregates.
        // A task is scoped to exactly one of: post, section, department.
        // The *_name columns below COALESCE the walk-up from whichever scope is set:
        //   post  → ap.name / aps.name / apd.name (via section + department FK)
        //   section → direct_sec.name / direct_sec_dept.name
        //   dept  → direct_dept.name
        const query = `
      SELECT
        t.*,
        u.display_name AS creator_name,
        u.avatar_url AS creator_avatar,
        au.display_name AS assignee_name,
        au.avatar_url AS assignee_avatar,
        au.email AS assignee_email,
        pp.title AS pug_project_title,
        ap.name AS assigned_post_name,
        COALESCE(aps.name, direct_sec.name) AS assigned_section_name,
        COALESCE(apd.name, direct_sec_dept.name, direct_dept.name) AS assigned_department_name,
        CASE
          WHEN t.assigned_post_id IS NOT NULL THEN 'post'
          WHEN t.assigned_section_id IS NOT NULL THEN 'section'
          WHEN t.assigned_department_id IS NOT NULL THEN 'department'
          ELSE NULL
        END AS assigned_scope,
        COALESCE(sub.total, 0) AS subtask_total,
        COALESCE(sub.completed, 0) AS subtask_completed,
        al.last_activity,
        CASE WHEN rt.id IS NOT NULL AND rt.is_active = true THEN true ELSE false END AS is_recurring,
        rt.frequency AS recurring_frequency,
        (SELECT tsc.reason FROM task_status_changes tsc
         WHERE tsc.task_id = t.id AND tsc.new_status = 'blocat'
         ORDER BY tsc.created_at DESC LIMIT 1) AS blocked_reason,
        COALESCE(deps.dep_count, 0) AS dependency_count,
        COALESCE(blks.blocks_count, 0) AS blocks_count
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      LEFT JOIN users au ON t.assigned_to = au.id
      LEFT JOIN pug_projects pp ON t.pug_project_id = pp.id
      -- Post scope
      LEFT JOIN posts ap ON t.assigned_post_id = ap.id
      LEFT JOIN sections aps ON ap.section_id = aps.id
      LEFT JOIN departments apd ON aps.department_id = apd.id
      -- Section scope (direct)
      LEFT JOIN sections direct_sec ON t.assigned_section_id = direct_sec.id
      LEFT JOIN departments direct_sec_dept ON direct_sec.department_id = direct_sec_dept.id
      -- Department scope (direct)
      LEFT JOIN departments direct_dept ON t.assigned_department_id = direct_dept.id
      -- audit-3 H4: every aggregate subquery filters by company_id so it
      -- doesn't scan all tenants' data before joining on task_id. At scale
      -- this turned a cheap index seek into a full-table aggregate.
      LEFT JOIN (
        SELECT task_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_completed = true) AS completed
        FROM subtasks WHERE deleted_at IS NULL AND company_id = $1 GROUP BY task_id
      ) sub ON sub.task_id = t.id
      LEFT JOIN (
        SELECT task_id, MAX(created_at) AS last_activity
        FROM activity_log WHERE company_id = $1 GROUP BY task_id
      ) al ON al.task_id = t.id
      LEFT JOIN recurring_tasks rt ON rt.template_task_id = t.id AND rt.company_id = $1
      LEFT JOIN (
        SELECT td2.blocked_task_id, COUNT(*) AS dep_count
        FROM task_dependencies td2
        JOIN tasks bt2 ON td2.blocking_task_id = bt2.id AND bt2.status != 'terminat'
        WHERE td2.company_id = $1
        GROUP BY td2.blocked_task_id
      ) deps ON deps.blocked_task_id = t.id
      LEFT JOIN (
        SELECT blocking_task_id, COUNT(*) AS blocks_count
        FROM task_dependencies WHERE company_id = $1
        GROUP BY blocking_task_id
      ) blks ON blks.blocking_task_id = t.id
      ${whereClause}
      ORDER BY
        CASE WHEN t.status = 'terminat' THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        values.push(parseInt(limit as string, 10), offset);

        const { rows } = await pool.query(query, values);

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) FROM tasks t ${whereClause}`;
        const countValues = values.slice(0, -2); // Remove limit and offset
        const { rows: countRows } = await pool.query(countQuery, countValues);

        res.json({
            tasks: rows,
            total: parseInt(countRows[0].count, 10),
            page: parseInt(page as string, 10),
            limit: parseInt(limit as string, 10)
        });
}));

// POST /api/tasks — create task
router.post('/', authMiddleware, validateCreateTask, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    // Tenant guard on referenced UUIDs (audit-3 C9 + C13): assigned_to,
    // assigned_post_id, assigned_section_id, assigned_department_id are
    // shape-validated by Zod but NOT tenant-validated. Without this, a
    // crafted payload could bind another company's post/section/dept/user
    // into a task in the active tenant.
    const cid = req.activeCompanyId;
    if (req.body.assigned_to && !(await userIsInCompany(req.body.assigned_to, cid))) {
        res.status(400).json({ error: tError(req, 'assignee_not_in_company') });
        return;
    }
    if (req.body.assigned_post_id && !(await rowIsInCompany('posts', req.body.assigned_post_id, cid))) {
        res.status(400).json({ error: tError(req, 'post_not_in_company') });
        return;
    }
    if (req.body.assigned_section_id && !(await rowIsInCompany('sections', req.body.assigned_section_id, cid))) {
        res.status(400).json({ error: tError(req, 'section_not_in_company') });
        return;
    }
    if (req.body.assigned_department_id && !(await rowIsInCompany('departments', req.body.assigned_department_id, cid))) {
        res.status(400).json({ error: tError(req, 'department_not_in_company') });
        return;
    }
    if (req.body.pug_project_id && !(await rowIsInCompany('pug_projects', req.body.pug_project_id, cid))) {
        res.status(400).json({ error: tError(req, 'pug_project_not_in_company') });
        return;
    }
    // The service now writes company_id directly in the initial INSERT, so
    // side-effect inserts (activity_log, notifications) all see the right tenant.
    const task = await taskService.createTask(req.body, req.user!.id, cid);
    res.status(201).json(task);
}));

// GET /api/tasks/:id — task details
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Multi-tenant guard: ensure the task belongs to the active company
    const { rows: tenantCheck } = await pool.query(
        `SELECT 1 FROM tasks WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.activeCompanyId]
    );
    if (tenantCheck.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_yours') });
        return;
    }

    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
        res.status(404).json({ error: tError(req, 'task_not_yours') });
        return;
    }

    if (!await checkTaskAccess(req.params.id, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }

    res.json(task);
}));

// PUT /api/tasks/:id — update task
router.put('/:id', authMiddleware, validateUpdateTask, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Multi-tenant guard
    const { rows: tenantCheck } = await pool.query(
        `SELECT 1 FROM tasks WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.activeCompanyId]
    );
    if (tenantCheck.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_yours') });
        return;
    }

    // Tenant guard on referenced UUIDs in the body (audit-3 C9 + C13).
    const cid2 = req.activeCompanyId;
    if (req.body.assigned_to && !(await userIsInCompany(req.body.assigned_to, cid2))) {
        res.status(400).json({ error: tError(req, 'assignee_not_in_company') });
        return;
    }
    if (req.body.assigned_post_id && !(await rowIsInCompany('posts', req.body.assigned_post_id, cid2))) {
        res.status(400).json({ error: tError(req, 'post_not_in_company') });
        return;
    }
    if (req.body.assigned_section_id && !(await rowIsInCompany('sections', req.body.assigned_section_id, cid2))) {
        res.status(400).json({ error: tError(req, 'section_not_in_company') });
        return;
    }
    if (req.body.assigned_department_id && !(await rowIsInCompany('departments', req.body.assigned_department_id, cid2))) {
        res.status(400).json({ error: tError(req, 'department_not_in_company') });
        return;
    }
    if (req.body.pug_project_id && !(await rowIsInCompany('pug_projects', req.body.pug_project_id, cid2))) {
        res.status(400).json({ error: tError(req, 'pug_project_not_in_company') });
        return;
    }

    const result = await taskService.updateTask(req.params.id, req.body, req.user!.id, req.activeCompanyId);
    if (result === null) {
        res.status(400).json({ error: tError(req, 'nothing_to_update') });
        return;
    }
    if (result === undefined) {
        res.status(404).json({ error: tError(req, 'task_not_yours') });
        return;
    }
    res.json(result);
}));

// PUT /api/tasks/:id/status — change status
router.put('/:id/status', authMiddleware, validateChangeStatus, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
        const { status, reason } = req.body as { status: TaskStatus; reason?: string };

        if (req.activeCompanyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }

        if (!await checkTaskAccess(id, req.user!.id, req.user!.role, req.activeCompanyId)) {
            res.status(403).json({ error: tError(req, 'task_no_permission') });
            return;
        }

        if (!status) {
            res.status(400).json({ error: tError(req, 'task_status_required') });
            return;
        }

        // CRITICAL RULE: reason is mandatory for 'blocat'
        if (status === 'blocat' && (!reason || reason.trim() === '')) {
            res.status(400).json({ error: tError(req, 'task_block_reason_required') });
            return;
        }

        // Atomic read-modify-write (audit-3 C15): wrap status flip in a
        // transaction with FOR UPDATE so two concurrent "complete" clicks
        // can't both see 'de_rezolvat', both flip to 'terminat', both fire
        // completion emails + both spawn the next recurring task.
        const txClient = await pool.connect();
        let oldStatus: string;
        let rows: any[];
        try {
            await txClient.query('BEGIN');
            const { rows: current } = await txClient.query(
                'SELECT status FROM tasks WHERE id = $1 AND company_id = $2 FOR UPDATE',
                [id, req.activeCompanyId]
            );
            if (current.length === 0) {
                await txClient.query('ROLLBACK');
                res.status(404).json({ error: tError(req, 'task_not_yours') });
                return;
            }
            oldStatus = current[0].status;

            // Idempotent: if the status is already what the caller wants,
            // commit nothing and respond 200 without re-firing side effects.
            if (oldStatus === status) {
                await txClient.query('ROLLBACK');
                const { rows: existing } = await pool.query(
                    'SELECT * FROM tasks WHERE id = $1 AND company_id = $2',
                    [id, req.activeCompanyId]
                );
                res.json(existing[0]);
                return;
            }

            // Status transition rules: 'terminat' is terminal. Reopening it
            // requires admin/superadmin/manager.
            if (oldStatus === 'terminat' && status !== 'terminat') {
                const callerRole = req.user!.role;
                const canReopen = callerRole === 'superadmin' || callerRole === 'admin' || callerRole === 'manager';
                if (!canReopen) {
                    await txClient.query('ROLLBACK');
                    res.status(403).json({ error: tError(req, 'only_managers_can_reopen') });
                    return;
                }
            }

            const r = await txClient.query(
                `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING *`,
                [status, id, req.activeCompanyId]
            );
            rows = r.rows;

            // Log status change inside the transaction so the audit row is
            // atomic with the mutation (avoids "status moved but no log" if
            // process dies between).
            await txClient.query(
                `INSERT INTO task_status_changes (task_id, old_status, new_status, reason, changed_by, company_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [id, oldStatus, status, reason || null, req.user!.id, req.activeCompanyId]
            );

            await txClient.query('COMMIT');
        } catch (err) {
            await txClient.query('ROLLBACK');
            throw err;
        } finally {
            txClient.release();
        }

        // (task_status_changes INSERT now lives inside the FOR UPDATE
        // transaction above — keeping it outside re-fired duplicates on race.)

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
       VALUES ($1, $2, 'status_changed', $3, $4)`,
            [id, req.user!.id, JSON.stringify({ old_status: oldStatus, new_status: status, reason: reason || null }), req.activeCompanyId]
        );

        // If status changed to 'terminat', auto-resolve all alerts
        if (status === 'terminat') {
            // Tenant filter (audit-3 C14): defense-in-depth so a hypothetical
            // cross-tenant task id can't update another company's alerts.
            await pool.query(
                `UPDATE task_alerts SET is_resolved = true, resolved_at = NOW()
                 WHERE task_id = $1 AND is_resolved = false AND company_id = $2`,
                [id, req.activeCompanyId]
            );

            // Also handle recurring tasks — wrapped in transaction for atomicity
            const { rows: recurringRows } = await pool.query(
                `SELECT * FROM recurring_tasks WHERE template_task_id = $1 AND is_active = true AND company_id = $2`,
                [id, req.activeCompanyId]
            );

            if (recurringRows.length > 0) {
                const recurring = recurringRows[0];
                const task = rows[0];

                // `recurring.next_run_date` was already set to the NEXT
                // occurrence's due date during setup (and again at every prior
                // completion). Use it AS-IS for the new task's due_date, then
                // advance it by the frequency for the row update. The old code
                // incremented twice — once at setup, once here — which made
                // every recurring task skip its first occurrence (e.g. monthly
                // task on Apr 30 would jump to Jun 30, skipping May).
                const newDueDate = new Date(recurring.next_run_date);
                let nextDueDate = new Date(recurring.next_run_date);
                switch (recurring.frequency) {
                    case 'daily':
                        nextDueDate.setDate(nextDueDate.getDate() + 1);
                        break;
                    case 'weekly':
                        nextDueDate.setDate(nextDueDate.getDate() + 7);
                        break;
                    case 'biweekly':
                        nextDueDate.setDate(nextDueDate.getDate() + 14);
                        break;
                    case 'monthly':
                        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                        break;
                    case 'quarterly':
                        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
                        break;
                    case 'yearly':
                        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
                        break;
                }
                // Roll forward to the next workday for ANY frequency that
                // requested workdays_only (previously only daily honored it).
                // Applied to BOTH the new task's due date and the stored
                // next_run_date so the cycle stays on workdays.
                //
                // "Workday" now means: not a weekend AND not in the
                // company_holidays table. That covers Hungarian national days
                // (Mar 15, Aug 20, Oct 23, …) and Romanian ones — the
                // recurring task no longer fires on a day nobody is working.
                if (recurring.workdays_only) {
                    const cid = task.company_id ?? req.activeCompanyId!;
                    await rollForwardToWorkday(newDueDate, cid);
                    await rollForwardToWorkday(nextDueDate, cid);
                }

                // Use a transaction to ensure all recurring task operations succeed or fail together
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    const newTaskId = uuidv4();
                    await client.query(
                        `INSERT INTO tasks (id, title, description, due_date, created_by, department_label,
                                            assigned_to, assigned_post_id, assigned_section_id, assigned_department_id,
                                            company_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                        [newTaskId, task.title, task.description, toLocalDateStr(newDueDate),
                            task.created_by, task.department_label,
                            task.assigned_to, task.assigned_post_id,
                            task.assigned_section_id, task.assigned_department_id,
                            task.company_id ?? req.activeCompanyId]
                    );

                    // Copy subtasks as template
                    const { rows: oldSubtasks } = await client.query(
                        `SELECT title, assigned_to, order_index FROM subtasks WHERE task_id = $1 AND deleted_at IS NULL ORDER BY order_index`,
                        [id]
                    );

                    for (const st of oldSubtasks) {
                        await client.query(
                            `INSERT INTO subtasks (task_id, title, assigned_to, order_index, company_id)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [newTaskId, st.title, st.assigned_to, st.order_index, task.company_id ?? req.activeCompanyId]
                        );
                    }

                    // Update recurring task to point to new task
                    await client.query(
                        `UPDATE recurring_tasks SET template_task_id = $1, next_run_date = $2, updated_at = NOW()
                         WHERE id = $3`,
                        [newTaskId, toLocalDateStr(nextDueDate), recurring.id]
                    );

                    // Activity log for recurring creation
                    await client.query(
                        `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
                         VALUES ($1, $2, 'recurring_created', $3, $4)`,
                        [newTaskId, req.user!.id, JSON.stringify({
                            source_task_id: id,
                            frequency: recurring.frequency,
                            new_due_date: toLocalDateStr(newDueDate)
                        }), task.company_id ?? req.activeCompanyId]
                    );

                    await client.query('COMMIT');
                } catch (recurringErr) {
                    await client.query('ROLLBACK');
                    console.error('Error creating recurring task (rolled back):', recurringErr);
                    // Don't fail the whole status change — the original task is already updated
                } finally {
                    client.release();
                }
            }

            // Handle dependency resolution: notify blocked tasks (tenant-scoped)
            const { rows: blockedTasks } = await pool.query(
                `SELECT td.blocked_task_id, t.title, t.assigned_to
                 FROM task_dependencies td
                 JOIN tasks t ON td.blocked_task_id = t.id
                 WHERE td.blocking_task_id = $1 AND t.deleted_at IS NULL AND t.company_id = $2`,
                [id, req.activeCompanyId]
            );

            const completedTaskTitle = rows[0].title;
            for (const bt of blockedTasks) {
                await pool.query(
                    `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
                     VALUES ($1, $2, 'dependency_resolved', $3, $4)`,
                    [bt.blocked_task_id, req.user!.id, JSON.stringify({ resolved_by_task: id, resolved_task_title: completedTaskTitle }), req.activeCompanyId]
                );
                if (bt.assigned_to) {
                    const payload = {
                        blockingTaskTitle: completedTaskTitle,
                        taskTitle: bt.title,
                    };
                    await pool.query(
                        `INSERT INTO notifications (user_id, task_id, type, message, payload, company_id)
                         VALUES ($1, $2, 'dependency_resolved', $3, $4, $5)`,
                        [bt.assigned_to, bt.blocked_task_id,
                         `\u201E${completedTaskTitle}\u201D s-a finalizat \u2014 sarcina ta \u201E${bt.title}\u201D este deblocat\u0103!`,
                         JSON.stringify(payload),
                         req.activeCompanyId]
                    );
                }
            }
        }

        // EMAIL: notify stakeholders about the status change.
        //
        // On completion (`terminat`) we deliberately do NOT send a separate
        // status-change email. Instead a single merged email goes out below —
        // the completion report with the status banner (old → Terminat + who
        // completed it) at the top — to the UNION of stakeholders and report
        // recipients, so nobody receives two emails for one completion.
        // (Robert, 2026-06-03 — see brain entry.)
        {
            const taskTitle = rows[0].title;
            const actor = req.user!.display_name;

            if (status !== 'terminat') (async () => {
                try {
                    const stakeholders = await getTaskStakeholders(id, req.user!.id);
                    for (const user of stakeholders) {
                        const language = await resolveRecipientLocale(user.id, req.activeCompanyId);
                        const newLabel = tServer(language, `notif_email.status_${status}`);
                        const oldLabel = tServer(language, `notif_email.status_${oldStatus}`);
                        const bodyLines = [
                            `<p style="color: #555; font-size: 14px;">${tServer(language, 'notif_email.body_user_changed_status', { actor })}</p>`,
                            `<p style="font-size: 14px; margin: 8px 0;">
                                <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${oldLabel}</span>
                                → <span style="background: ${status === 'blocat' ? '#fee2e2' : '#dbeafe'}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${newLabel}</span>
                            </p>`,
                        ];
                        if (status === 'blocat' && reason) {
                            bodyLines.push(`<p style="color: #EF4444; font-size: 13px; margin-top: 8px;">📝 ${reason}</p>`);
                        }
                        const htmlBody = buildNotificationHtml({
                            recipientName: user.display_name,
                            subtitle: tServer(language, 'notif_email.sub_status_changed', { status: newLabel }),
                            bodyLines,
                            taskId: id,
                            taskTitle,
                            language,
                            companyId: req.activeCompanyId,
                        });
                        sendNotificationEmail({
                            userId: user.id, userEmail: user.email, userName: user.display_name,
                            taskId: id, subject: tServer(language, 'notif_email.subj_status_changed', { status: newLabel, title: taskTitle }),
                            htmlBody, emailType: 'status_changed',
                            companyId: req.activeCompanyId,
                        }).catch(err => console.error('[status_changed] Email error:', err));
                    }
                } catch (err) {
                    console.error('[status_changed] Email notification error:', err);
                }
            })();

            // COMPLETION: a single merged email (status banner + full summary)
            // sent to the union of stakeholders and report recipients, deduped by
            // id so each person receives exactly one email for the completion.
            if (status === 'terminat') {
                (async () => {
                    try {
                        const [stakeholders, reportRecipients] = await Promise.all([
                            getTaskStakeholders(id, req.user!.id),
                            getCompletionReportRecipients(id, req.user!.id),
                        ]);
                        const recipientsById = new Map<string, { id: string; email: string; display_name: string }>();
                        for (const u of stakeholders) recipientsById.set(u.id, u);
                        for (const u of reportRecipients) recipientsById.set(u.id, u);
                        const recipients = Array.from(recipientsById.values());

                        // Build the report once per language so each recipient gets
                        // it in their own locale instead of a hardcoded one.
                        const reportHtmlByLang = new Map<string, string>();
                        for (const recipient of recipients) {
                            const language = await resolveRecipientLocale(recipient.id, req.activeCompanyId);
                            if (!reportHtmlByLang.has(language)) {
                                reportHtmlByLang.set(language, await buildCompletionReportHtml(id, language, {
                                    oldStatus, newStatus: status, actorName: actor, reason,
                                }));
                            }
                            sendNotificationEmail({
                                userId: recipient.id,
                                userEmail: recipient.email,
                                userName: recipient.display_name,
                                taskId: id,
                                subject: tServer(language, 'notif_email.subj_completion_report', { title: taskTitle }),
                                htmlBody: reportHtmlByLang.get(language)!,
                                emailType: 'completion_report',
                                companyId: req.activeCompanyId,
                            }).catch(err => console.error('[completion_report] Email error:', err));
                        }
                    } catch (err) {
                        console.error('[completion_report] Error:', err);
                    }
                })();
            }
        }

        // Webhook: task.status_changed
        dispatchWebhook('task.status_changed', {
            task: rows[0],
            actor: { id: req.user!.id, name: req.user!.display_name, email: req.user!.email },
            changes: { old_status: oldStatus, new_status: status }
        }).catch(err => console.error('[WEBHOOK] task.status_changed dispatch error:', err.message));

        // Webhook: task.completed (extra event when finishing)
        if (status === 'terminat') {
            dispatchWebhook('task.completed', {
                task: rows[0],
                actor: { id: req.user!.id, name: req.user!.display_name, email: req.user!.email }
            }).catch(err => console.error('[WEBHOOK] task.completed dispatch error:', err.message));
        }

        res.json(rows[0]);
}));

// PUT /api/tasks/:id/due-date — change due date (reason mandatory)
// Optional `realign_recurring` flag: if true and the task has an active recurring
// rule, the rule's next_run_date is shifted to the new date so subsequent
// instances spawn from there. Without this flag, only this single instance moves
// and the recurring schedule keeps its original cadence.
router.put('/:id/due-date', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
        const { due_date, reason, realign_recurring } = req.body;

        if (req.activeCompanyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }

        if (!await checkTaskAccess(id, req.user!.id, req.user!.role, req.activeCompanyId)) {
            res.status(403).json({ error: tError(req, 'task_no_permission') });
            return;
        }

        if (!due_date) {
            res.status(400).json({ error: tError(req, 'task_due_date_required') });
            return;
        }

        // CRITICAL RULE: reason is always mandatory
        if (!reason || reason.trim() === '') {
            res.status(400).json({ error: tError(req, 'task_reschedule_reason_required') });
            return;
        }

        // Get current due date (tenant-scoped)
        const { rows: current } = await pool.query(
            'SELECT due_date FROM tasks WHERE id = $1 AND company_id = $2',
            [id, req.activeCompanyId]
        );
        if (current.length === 0) {
            res.status(404).json({ error: tError(req, 'task_not_yours') });
            return;
        }

        const oldDate = current[0].due_date;

        // Update task (tenant-scoped)
        const { rows } = await pool.query(
            `UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING *`,
            [due_date, id, req.activeCompanyId]
        );

        // If asked, realign the recurring rule so future instances follow the new date.
        // We only update if a recurring rule actually exists & is active — otherwise the
        // flag is silently a no-op (the task may have lost recurrence between client
        // fetch and submit).
        let recurringRealigned = false;
        if (realign_recurring === true) {
            const { rowCount } = await pool.query(
                `UPDATE recurring_tasks
                 SET next_run_date = $1, updated_at = NOW()
                 WHERE template_task_id = $2 AND is_active = true
                   AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = recurring_tasks.template_task_id AND t.company_id = $3)`,
                [due_date, id, req.activeCompanyId]
            );
            recurringRealigned = (rowCount ?? 0) > 0;
        }

        // Log due date change
        await pool.query(
            `INSERT INTO task_due_date_changes (task_id, old_date, new_date, reason, changed_by, company_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, oldDate, due_date, reason, req.user!.id, req.activeCompanyId]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
       VALUES ($1, $2, 'due_date_changed', $3, $4)`,
            [id, req.user!.id, JSON.stringify({
                old_date: oldDate,
                new_date: due_date,
                reason,
                recurring_realigned: recurringRealigned
            }), req.activeCompanyId]
        );

        // Auto-comment: make the date change reason visible in the Comments tab
        const oldDateStr = new Date(oldDate).toLocaleDateString('ro-RO');
        const newDateStr = new Date(due_date).toLocaleDateString('ro-RO');
        let commentContent = `📅 Data limită schimbată: ${oldDateStr} → ${newDateStr}\n📝 Motiv: ${reason}`;
        if (recurringRealigned) {
            commentContent += `\n🔁 Recurența a fost realiniată: și următoarele instanțe vor pornî de la noua dată.`;
        }
        await pool.query(
            `INSERT INTO task_comments (task_id, author_id, content, mentions, company_id)
       VALUES ($1, $2, $3, $4, $5)`,
            [id, req.user!.id, commentContent, [], req.activeCompanyId]
        );

        // Activity log for the auto-comment
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
       VALUES ($1, $2, 'comment_added', $3, $4)`,
            [id, req.user!.id, JSON.stringify({
                comment_preview: commentContent.substring(0, 100),
                mentions: [],
                auto_generated: true
            }), req.activeCompanyId]
        );

        res.json(rows[0]);
}));

// DELETE /api/tasks/:id — soft delete task
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Multi-tenant guard
    const { rows: tenantCheck } = await pool.query(
        `SELECT 1 FROM tasks WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.activeCompanyId]
    );
    if (tenantCheck.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_found_or_deleted') });
        return;
    }

    const result = await taskService.softDeleteTask(req.params.id, req.user!.id, req.user!.role, req.activeCompanyId);
    if ('error' in result) {
        if (result.error === tError(req, 'not_found')) {
            res.status(404).json({ error: tError(req, 'task_not_found_or_deleted') });
            return;
        }
        res.status(403).json({ error: `Nu ai permisiunea de a șterge acest task. (role: ${req.user!.role})` });
        return;
    }
    res.status(204).send();
}));

// POST /api/tasks/:id/duplicate — duplicate task with subtasks
router.post('/:id/duplicate', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Multi-tenant guard on the source task
    const { rows: tenantCheck } = await pool.query(
        `SELECT 1 FROM tasks WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.activeCompanyId]
    );
    if (tenantCheck.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_found_alt') });
        return;
    }

    const newTask = await taskService.duplicateTask(req.params.id, req.user!.id, req.activeCompanyId);
    if (!newTask) {
        res.status(404).json({ error: tError(req, 'task_not_found_alt') });
        return;
    }
    res.status(201).json(newTask);
}));

// === SUB-ROUTERS (mounted on /:id) ===
router.use('/:id', taskSubtaskRoutes);
router.use('/:id', taskCommentRoutes);
router.use('/:id', taskAttachmentRoutes);
router.use('/:id', taskActivityRoutes);
router.use('/:id', taskRecurringRoutes);
router.use('/:id', taskAlertRoutes);
router.use('/:id', taskDependencyRoutes);
router.use('/:id', taskChecklistRoutes);

export default router;
