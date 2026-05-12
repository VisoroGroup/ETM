/**
 * External REST API — /api/v1
 *
 * Authenticated via Bearer API token (generated in admin panel).
 * Provides read + limited write access:
 *  - List projects (departments)
 *  - List tasks with filters
 *  - Get task details
 *  - Update task (status, assignee)
 *  - Add comment to task
 *  - Summary/overview stats
 *  - List users (for filters)
 *
 * Tenant scoping: every endpoint requires `req.activeCompanyId` (loaded by
 * apiTokenAuth from the X-Active-Company header, falling back to the user's
 * first company). All SELECT/INSERT/UPDATE/DELETE statements MUST include
 * `company_id = $activeCompanyId` to prevent cross-tenant leaks.
 */
import { Router, Response } from 'express';
import pool from '../config/database';
import { apiTokenAuth, ApiAuthRequest } from '../middleware/apiTokenAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { DEPARTMENTS, STATUSES, TaskStatus } from '../types';
import * as taskService from '../services/taskService';
import { getAttachmentContent, getMimeType } from '../services/attachmentContentService';
import { checkTaskAccess } from '../middleware/taskAccess';
import rateLimit from 'express-rate-limit';
import { tError } from '../utils/serverErrors';

const router = Router();

// Per-token rate limiting — 100 requests per minute. Use a per-request
// handler so the rate-limit error gets translated per the caller's locale
// (audit-3 H18).
const apiRateLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    keyGenerator: (req: any) => req.apiToken?.id || req.ip,
    handler: (req, res) => {
        res.status(429).json({ error: tError(req, 'rate_limit_external') });
    },
});

// All /api/v1 routes use API token auth + rate limiting
router.use(apiTokenAuth);
router.use(apiRateLimiter);

/**
 * Guard: every endpoint requires an active company. Returns 400 with a
 * Romanian error message if the header was missing/invalid AND the token's
 * user has no companies (apiTokenAuth would normally 401 in that case, but we
 * defend in depth here for any sub-route that might bypass that path).
 */
function requireActiveCompany(req: ApiAuthRequest, res: Response): number | null {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return null;
    }
    return req.activeCompanyId;
}

// ==========================================
// GET /api/v1/projects — list departments as "projects"
// ==========================================
router.get('/projects', (_req: ApiAuthRequest, res: Response) => {
    const projects = Object.entries(DEPARTMENTS).map(([key, { label, color }]) => ({
        id: key,
        name: label,
        color,
    }));
    res.json({ projects });
});

// ==========================================
// GET /api/v1/users — list active users in the active company
// ==========================================
router.get('/users', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const { rows } = await pool.query(`
        SELECT u.id, u.display_name, u.email, u.role, u.departments
        FROM users u
        JOIN user_companies uc ON uc.user_id = u.id
        WHERE u.is_active = true AND uc.company_id = $1
        ORDER BY u.display_name ASC
    `, [companyId]);
    res.json({ users: rows });
}));

// ==========================================
// GET /api/v1/tasks — list tasks with filters
// ==========================================
router.get('/tasks', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const {
        status,
        department,
        assigned_to,
        search,
        due_before,
        due_after,
        include_completed,
        page = '1',
        limit = '50'
    } = req.query;

    // Tenant scope first — every SELECT must filter by company_id.
    const conditions: string[] = ['t.deleted_at IS NULL', 't.company_id = $1'];
    const values: any[] = [companyId];
    let paramIndex = 2;

    // Exclude completed by default, unless explicitly requested
    if (include_completed !== 'true') {
        conditions.push(`t.status != 'terminat'`);
    }

    // Status filter (comma-separated) — validate against known statuses
    if (status) {
        const validStatuses = ['de_rezolvat', 'in_realizare', 'terminat', 'blocat'];
        const statuses = (status as string).split(',').filter(s => validStatuses.includes(s));
        if (statuses.length === 0) {
            res.status(400).json({
                error: `Status invalid: "${status}". Valori acceptate: ${validStatuses.join(', ')}`,
                valid_statuses: validStatuses.map(s => ({ value: s, label: STATUSES[s as TaskStatus]?.label })),
            });
            return;
        }
        conditions.push(`t.status = ANY($${paramIndex++})`);
        values.push(statuses);
    }

    // Department filter (comma-separated)
    if (department) {
        const depts = (department as string).split(',');
        conditions.push(`t.department_label = ANY($${paramIndex++})`);
        values.push(depts);
    }

    // Assigned to filter
    if (assigned_to) {
        conditions.push(`t.assigned_to = $${paramIndex++}`);
        values.push(assigned_to);
    }

    // Search
    if (search) {
        const q = (search as string).trim();
        conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
        values.push(`%${q}%`);
        paramIndex++;
    }

    // Due date range
    if (due_before) {
        conditions.push(`t.due_date <= $${paramIndex++}`);
        values.push(due_before);
    }
    if (due_after) {
        conditions.push(`t.due_date >= $${paramIndex++}`);
        values.push(due_after);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const query = `
        SELECT
            t.id, t.title, t.description, t.status, t.due_date,
            t.department_label, t.assigned_to, t.created_at, t.updated_at,
            u.display_name AS creator_name,
            au.display_name AS assignee_name,
            COALESCE(sub.total, 0) AS subtask_total,
            COALESCE(sub.completed, 0) AS subtask_completed,
            (SELECT tsc.reason FROM task_status_changes tsc
             WHERE tsc.task_id = t.id AND tsc.new_status = 'blocat' AND tsc.company_id = t.company_id
             ORDER BY tsc.created_at DESC LIMIT 1) AS blocked_reason
        FROM tasks t
        JOIN users u ON t.created_by = u.id
        LEFT JOIN users au ON t.assigned_to = au.id
        LEFT JOIN (
            SELECT task_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_completed = true) AS completed
            FROM subtasks WHERE deleted_at IS NULL AND company_id = $1 GROUP BY task_id
        ) sub ON sub.task_id = t.id
        ${whereClause}
        ORDER BY
            CASE WHEN t.status = 'terminat' THEN 1 ELSE 0 END,
            t.due_date ASC,
            t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limitNum, offset);

    const { rows } = await pool.query(query, values);

    // Count total (uses the same WHERE clause + params, minus LIMIT/OFFSET)
    const countQuery = `SELECT COUNT(*) FROM tasks t ${whereClause}`;
    const countValues = values.slice(0, -2);
    const { rows: countRows } = await pool.query(countQuery, countValues);

    // Map status codes to human-readable labels
    const tasks = rows.map(t => ({
        ...t,
        status_label: STATUSES[t.status as TaskStatus]?.label || t.status,
        department_name: DEPARTMENTS[t.department_label as keyof typeof DEPARTMENTS]?.label || t.department_label,
        is_overdue: t.due_date && new Date(t.due_date) < new Date() && t.status !== 'terminat',
    }));

    res.json({
        tasks,
        total: parseInt(countRows[0].count, 10),
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(parseInt(countRows[0].count, 10) / limitNum),
    });
}));

// GET /api/v1/tasks/summary — redirect to /summary (common MCP mistake)
// MUST be before /tasks/:id to avoid matching 'summary' as a UUID
router.get('/tasks/summary', asyncHandler(async (_req: ApiAuthRequest, res: Response) => {
    res.redirect(307, '/api/v1/summary');
}));

// ==========================================
// GET /api/v1/tasks/:id — task details
// ==========================================
router.get('/tasks/:id', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    // Tenant guard FIRST: confirm the task belongs to the active company before
    // we hand its id to the (currently company-blind) taskService.
    const { rows: tenantRows } = await pool.query(
        'SELECT 1 FROM tasks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [req.params.id, companyId]
    );
    if (tenantRows.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_found') });
        return;
    }

    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
        res.status(404).json({ error: tError(req, 'task_not_found') });
        return;
    }

    // checkTaskAccess will receive companyId once Agent 1 lands; for now the
    // tenant guard above already proves the task belongs to the active company.
    if (!await checkTaskAccess(req.params.id, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'access_denied_task') });
        return;
    }

    // Add human-readable labels
    const enriched = {
        ...task,
        status_label: STATUSES[task.status as TaskStatus]?.label || task.status,
        department_name: DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS]?.label || task.department_label,
        is_overdue: task.due_date && new Date(task.due_date) < new Date() && task.status !== 'terminat',
    };

    res.json(enriched);
}));

// ==========================================
// PUT /api/v1/tasks/:id — update task (status, assignee)
// ==========================================
router.put('/tasks/:id', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const { id } = req.params;
    const { status, assigned_to, reason } = req.body;

    // Tenant guard before anything else.
    const { rows: tenantRows } = await pool.query(
        'SELECT 1 FROM tasks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
    );
    if (tenantRows.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_found') });
        return;
    }

    if (!await checkTaskAccess(id, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'access_denied_task') });
        return;
    }

    // Validate at least one field to update
    if (!status && assigned_to === undefined) {
        res.status(400).json({ error: tError(req, 'must_specify_status_or_assignee') });
        return;
    }

    // If status change requested
    if (status) {
        const validStatuses: TaskStatus[] = ['de_rezolvat', 'in_realizare', 'terminat', 'blocat'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({
                error: `Status invalid. Valori acceptate: ${validStatuses.join(', ')}`,
                status_labels: Object.entries(STATUSES).map(([k, v]) => ({ value: k, label: v.label })),
            });
            return;
        }

        // Blocked requires reason
        if (status === 'blocat' && (!reason || reason.trim() === '')) {
            res.status(400).json({ error: tError(req, 'task_block_reason_required') });
            return;
        }

        // Get current status — tenant-scoped.
        const { rows: current } = await pool.query(
            'SELECT status FROM tasks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
            [id, companyId]
        );
        if (current.length === 0) {
            res.status(404).json({ error: tError(req, 'task_not_found') });
            return;
        }

        const oldStatus = current[0].status;

        // Update status — tenant-scoped.
        await pool.query(
            'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
            [status, id, companyId]
        );

        // Log status change
        await pool.query(
            `INSERT INTO task_status_changes (task_id, old_status, new_status, reason, changed_by, company_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, oldStatus, status, reason || null, req.user!.id, companyId]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
             VALUES ($1, $2, 'status_changed', $3, $4)`,
            [id, req.user!.id, JSON.stringify({
                old_status: oldStatus,
                new_status: status,
                reason: reason || null,
                via: 'api_v1'
            }), companyId]
        );

        // Auto-resolve alerts when completing
        if (status === 'terminat') {
            await pool.query(
                `UPDATE task_alerts SET is_resolved = true, resolved_at = NOW()
                 WHERE task_id = $1 AND is_resolved = false AND company_id = $2`,
                [id, companyId]
            );
        }
    }

    // If assignee change requested
    if (assigned_to !== undefined) {
        // Pass companyId so taskService.updateTask applies its defense-in-depth
        // company_id filter (audit-3 C10). Without it, the service's SELECT
        // FOR UPDATE falls back to the no-tenant query path.
        const result = await taskService.updateTask(id, { assigned_to: assigned_to || undefined }, req.user!.id, companyId);
        if (result === undefined) {
            res.status(404).json({ error: tError(req, 'task_not_found') });
            return;
        }
    }

    // Return updated task
    const updated = await taskService.getTaskById(id);
    res.json({
        message: 'Sarcina a fost actualizată.',
        task: updated ? {
            ...updated,
            status_label: STATUSES[updated.status as TaskStatus]?.label || updated.status,
        } : null,
    });
}));

// ==========================================
// POST /api/v1/tasks/:id/comments — add comment
// ==========================================
router.post('/tasks/:id/comments', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const { id: taskId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        res.status(400).json({ error: tError(req, 'comment_content_required') });
        return;
    }

    // Verify task exists IN THE ACTIVE COMPANY.
    const { rows: taskRows } = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [taskId, companyId]
    );
    if (taskRows.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_found') });
        return;
    }

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'access_denied_task') });
        return;
    }

    const { rows } = await pool.query(
        `INSERT INTO task_comments (task_id, author_id, content, mentions, company_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [taskId, req.user!.id, content, [], companyId]
    );

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
         VALUES ($1, $2, 'comment_added', $3, $4)`,
        [taskId, req.user!.id, JSON.stringify({
            comment_preview: content.substring(0, 100),
            mentions: [],
            via: 'api_v1'
        }), companyId]
    );

    rows[0].author_name = req.user!.display_name;
    res.status(201).json(rows[0]);
}));

// ==========================================
// GET /api/v1/summary — overview stats (scoped to active company)
// ==========================================
router.get('/summary', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const today = new Date().toISOString().split('T')[0];

    // Status breakdown
    const { rows: statusBreakdown } = await pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM tasks
        WHERE deleted_at IS NULL AND company_id = $1
        GROUP BY status
        ORDER BY status
    `, [companyId]);

    // Overdue tasks
    const { rows: overdueRows } = await pool.query(`
        SELECT t.id, t.title, t.due_date, t.status, t.department_label,
               au.display_name AS assignee_name,
               (CURRENT_DATE - t.due_date::date) AS days_overdue
        FROM tasks t
        LEFT JOIN users au ON t.assigned_to = au.id
        WHERE t.due_date < $1 AND t.status NOT IN ('terminat')
              AND t.deleted_at IS NULL AND t.company_id = $2
        ORDER BY t.due_date ASC
        LIMIT 20
    `, [today, companyId]);

    // Per-user workload — restrict users to those in the active company.
    const { rows: userWorkload } = await pool.query(`
        SELECT u.id, u.display_name,
               COUNT(t.id)::int AS total_tasks,
               COUNT(t.id) FILTER (WHERE t.status = 'in_realizare')::int AS in_progress,
               COUNT(t.id) FILTER (WHERE t.status = 'de_rezolvat')::int AS todo,
               COUNT(t.id) FILTER (WHERE t.status = 'blocat')::int AS blocked,
               COUNT(t.id) FILTER (WHERE t.due_date < $1 AND t.status != 'terminat')::int AS overdue
        FROM users u
        JOIN user_companies uc ON uc.user_id = u.id AND uc.company_id = $2
        LEFT JOIN tasks t ON t.assigned_to = u.id
                          AND t.deleted_at IS NULL
                          AND t.status != 'terminat'
                          AND t.company_id = $2
        WHERE u.is_active = true
        GROUP BY u.id, u.display_name
        HAVING COUNT(t.id) > 0
        ORDER BY total_tasks DESC
    `, [today, companyId]);

    // Totals
    const { rows: [totals] } = await pool.query(`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('de_rezolvat', 'in_realizare'))::int AS active,
            COUNT(*) FILTER (WHERE status = 'terminat')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'blocat')::int AS blocked,
            COUNT(*) FILTER (WHERE due_date < $1 AND status != 'terminat')::int AS overdue
        FROM tasks WHERE deleted_at IS NULL AND company_id = $2
    `, [today, companyId]);

    // Add human-readable labels to status breakdown
    const statusWithLabels = statusBreakdown.map(s => ({
        ...s,
        label: STATUSES[s.status as TaskStatus]?.label || s.status,
    }));

    // Add human-readable info to overdue tasks
    const overdueFormatted = overdueRows.map(t => ({
        ...t,
        status_label: STATUSES[t.status as TaskStatus]?.label || t.status,
        department_name: DEPARTMENTS[t.department_label as keyof typeof DEPARTMENTS]?.label || t.department_label,
    }));

    res.json({
        totals,
        status_breakdown: statusWithLabels,
        overdue_tasks: overdueFormatted,
        user_workload: userWorkload,
        generated_at: new Date().toISOString(),
    });
}));

// ==========================================
// GET /api/v1/tasks/:taskId/attachments — list attachments
// ==========================================
router.get('/tasks/:taskId/attachments', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const { taskId } = req.params;

    // Verify task exists IN THE ACTIVE COMPANY.
    const { rows: taskRows } = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [taskId, companyId]
    );
    if (taskRows.length === 0) {
        res.status(404).json({ error: tError(req, 'task_not_found') });
        return;
    }

    const { rows } = await pool.query(
        `SELECT a.id, a.task_id, a.file_name, a.file_url, a.file_size, a.created_at,
                u.display_name AS uploaded_by
         FROM task_attachments a
         JOIN users u ON a.uploaded_by = u.id
         WHERE a.task_id = $1 AND a.company_id = $2
         ORDER BY a.created_at DESC`,
        [taskId, companyId]
    );

    const attachments = rows.map(a => ({
        id: a.id,
        task_id: a.task_id,
        filename: a.file_name,
        file_type: getMimeType(a.file_name),
        file_size: a.file_size,
        uploaded_by: a.uploaded_by,
        uploaded_at: a.created_at,
    }));

    res.json({ attachments });
}));

// ==========================================
// GET /api/v1/attachments/:attachmentId/content — get file content
// ==========================================
router.get('/attachments/:attachmentId/content', asyncHandler(async (req: ApiAuthRequest, res: Response) => {
    const companyId = requireActiveCompany(req, res);
    if (companyId === null) return;

    const { attachmentId } = req.params;
    const format = (req.query.format as string) === 'base64' ? 'base64' : 'text';
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const limit = Math.min(100000, Math.max(1, parseInt(req.query.limit as string, 10) || 100000));

    // Look up attachment — tenant-scoped via the attachment's company_id.
    const { rows } = await pool.query(
        `SELECT a.id, a.task_id, a.file_name, a.file_url, a.file_size,
                u.display_name AS uploaded_by
         FROM task_attachments a
         JOIN users u ON a.uploaded_by = u.id
         WHERE a.id = $1 AND a.company_id = $2`,
        [attachmentId, companyId]
    );

    if (rows.length === 0) {
        res.status(404).json({ error: tError(req, 'attachment_not_found') });
        return;
    }

    const attachment = rows[0];

    // Verify parent task still exists in the active company.
    const { rows: taskRows } = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [attachment.task_id, companyId]
    );
    if (taskRows.length === 0) {
        res.status(404).json({ error: tError(req, 'parent_task_deleted') });
        return;
    }

    // Check task access for the API token user
    if (!await checkTaskAccess(attachment.task_id, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }

    try {
        const result = await getAttachmentContent(
            attachment.file_url,
            attachment.file_name,
            attachment.id,
            format,
            offset,
            limit
        );

        // Activity log (non-blocking)
        try {
            await pool.query(
                `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
                 VALUES ($1, $2, 'attachment_read', $3, $4)`,
                [attachment.task_id, req.user!.id, JSON.stringify({
                    attachment_id: attachment.id,
                    filename: attachment.file_name,
                    format,
                    via: 'api_v1'
                }), companyId]
            );
        } catch (logErr) {
            console.error('[externalApi] attachment_read log failed:', logErr);
        }

        res.json(result);
    } catch (err: any) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
}));

export default router;
