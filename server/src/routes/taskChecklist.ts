import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { asyncHandler } from '../middleware/errorHandler';
import { tError } from '../utils/serverErrors';
import {
    getSpecificStakeholders,
    buildNotificationHtml,
    sendNotificationEmail,
    escapeHtml,
    resolveRecipientLocale,
} from '../services/notificationEmailService';
import { tServer } from '../i18n/serverI18n';

const router = Router({ mergeParams: true });

// Helper: confirm a checklist item belongs to :taskId AND active tenant.
async function getChecklistItemInTenant(itemId: string, taskId: string, companyId: number) {
    const { rows } = await pool.query(
        `SELECT ci.* FROM task_checklist_items ci
         JOIN tasks t ON t.id = ci.task_id
         WHERE ci.id = $1 AND ci.task_id = $2 AND t.company_id = $3 AND t.deleted_at IS NULL`,
        [itemId, taskId, companyId]
    );
    return rows[0] || null;
}

// GET /api/tasks/:id/checklist
router.get('/checklist', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id;
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    const { rows } = await pool.query(
        `SELECT * FROM task_checklist_items WHERE task_id = $1 ORDER BY order_index ASC`,
        [taskId]
    );
    res.json(rows);
}));

// POST /api/tasks/:id/checklist
router.post('/checklist', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }

    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: tError(req, 'task_title_required') });
        return;
    }
    if (title.length > 500) {
        res.status(400).json({ error: tError(req, 'task_title_too_long') });
        return;
    }

    // Verify task exists and is not deleted (tenant-scoped)
    const { rows: taskCheck } = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL AND company_id = $2',
        [taskId, companyId]
    );
    if (taskCheck.length === 0) {
        res.status(404).json({ error: tError(req, 'task_deleted_or_inaccessible') });
        return;
    }

    // Auto order_index
    const { rows: [{ next_idx }] } = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM task_checklist_items WHERE task_id = $1`,
        [taskId]
    );

    const { rows: [item] } = await pool.query(
        `INSERT INTO task_checklist_items (task_id, title, order_index, created_by, company_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [taskId, title.trim(), next_idx, req.user!.id, companyId]
    );

    // Activity log (non-blocking — don't let enum errors block the actual add)
    try {
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
             VALUES ($1, $2, 'checklist_updated', $3, $4)`,
            [taskId, req.user!.id, JSON.stringify({ action: 'item_added', title: title.trim() }), companyId]
        );
    } catch (err) {
        console.error('[checklist] Activity log failed (enum may be missing):', err);
    }

    res.status(201).json(item);
}));

// PUT /api/tasks/:id/checklist/:itemId
router.put('/checklist/:itemId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, is_checked } = req.body;
    const { id: taskId, itemId } = req.params;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Tenant + parent guard
    const oldItem = await getChecklistItemInTenant(itemId, taskId, companyId);
    if (!oldItem) {
        res.status(404).json({ error: tError(req, 'checklist_item_not_found') });
        return;
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (is_checked !== undefined) { sets.push(`is_checked = $${idx++}`); vals.push(is_checked); }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) { // only updated_at
        res.status(400).json({ error: tError(req, 'nothing_to_update') });
        return;
    }

    vals.push(itemId, taskId);
    const { rows } = await pool.query(
        `UPDATE task_checklist_items SET ${sets.join(', ')} WHERE id = $${idx++} AND task_id = $${idx} RETURNING *`,
        vals
    );

    if (rows.length === 0) {
        res.status(404).json({ error: tError(req, 'checklist_item_not_found') });
        return;
    }

    // EMAIL: checklist item checked (false → true only)
    if (is_checked === true && oldItem.is_checked === false) {
        (async () => {
            try {
                const { rows: taskRows } = await pool.query('SELECT title, created_by, assigned_to FROM tasks WHERE id = $1', [taskId]);
                const task = taskRows[0];
                if (!task) return;
                const itemTitle = title || oldItem.title;
                const stakeholders = await getSpecificStakeholders([task.created_by, task.assigned_to], req.user!.id);
                for (const user of stakeholders) {
                    const language = await resolveRecipientLocale(user.id, companyId);
                    const actor = req.user!.display_name;
                    const htmlBody = buildNotificationHtml({
                        recipientName: user.display_name,
                        subtitle: tServer(language, 'notif_email.sub_checklist_checked'),
                        bodyLines: [
                            `<p style="color: #555; font-size: 14px;">${tServer(language, 'notif_email.body_user_checked_item', { actor })}</p>`,
                            `<p style="color: #065f46; font-size: 14px; font-weight: bold; margin: 8px 0;">☑️ ${escapeHtml(itemTitle)}</p>`,
                        ],
                        taskId,
                        taskTitle: task.title,
                        language,
                        companyId,
                    });
                    sendNotificationEmail({
                        userId: user.id, userEmail: user.email, userName: user.display_name,
                        taskId, subject: tServer(language, 'notif_email.subj_checklist_checked', { title: itemTitle }),
                        htmlBody, emailType: 'checklist_checked',
                        companyId,
                    }).catch(err => console.error('[checklist_checked] Email error:', err));
                }
            } catch (err) {
                console.error('[checklist_checked] Email notification error:', err);
            }
        })();
    }

    res.json(rows[0]);
}));

// PUT /api/tasks/:id/checklist-reorder
router.put('/checklist-reorder', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }

    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
        res.status(400).json({ error: tError(req, 'order_list_required') });
        return;
    }

    const ids = order.map((o: any) => o.id);
    const indexes = order.map((o: any) => o.order_index);

    await pool.query(
        `UPDATE task_checklist_items s SET order_index = v.new_order
         FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS new_order) v
         WHERE s.id = v.id AND s.task_id = $3`,
        [ids, indexes, req.params.id]
    );

    res.json({ message: 'Ordine actualizată.' });
}));

// DELETE /api/tasks/:id/checklist/:itemId
router.delete('/checklist/:itemId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, itemId } = req.params;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }

    // Tenant + parent guard
    const existing = await getChecklistItemInTenant(itemId, taskId, companyId);
    if (!existing) {
        res.status(404).json({ error: tError(req, 'checklist_item_not_found') });
        return;
    }

    const { rows } = await pool.query(
        `DELETE FROM task_checklist_items WHERE id = $1 AND task_id = $2 RETURNING *`,
        [itemId, taskId]
    );

    if (rows.length === 0) {
        res.status(404).json({ error: tError(req, 'checklist_item_not_found') });
        return;
    }

    res.json({ message: 'Element șters.' });
}));

export default router;
