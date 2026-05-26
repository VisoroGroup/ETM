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
    resolveRecipientLocale,
} from '../services/notificationEmailService';
import { tServer } from '../i18n/serverI18n';
import { userIsInCompany } from '../utils/tenantGuard';

const router = Router({ mergeParams: true });

// Helper: confirm a subtask belongs to :taskId AND active tenant.
async function getSubtaskInTenant(subtaskId: string, taskId: string, companyId: number) {
    const { rows } = await pool.query(
        `SELECT s.* FROM subtasks s
         JOIN tasks t ON t.id = s.task_id
         WHERE s.id = $1 AND s.task_id = $2 AND t.company_id = $3 AND t.deleted_at IS NULL`,
        [subtaskId, taskId, companyId]
    );
    return rows[0] || null;
}

// POST /api/tasks/:id/subtasks
router.post('/subtasks', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;
        const { title, assigned_to, due_date, priority } = req.body;
        const companyId = req.activeCompanyId;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
            res.status(403).json({ error: tError(req, 'task_no_permission') });
            return;
        }

        if (!title) {
            res.status(400).json({ error: tError(req, 'subtask_title_required') });
            return;
        }

        // Tenant guard on assigned_to (audit-3 C11): without this, a crafted
        // user UUID from another tenant can be assigned as subtask owner
        // (then receives notifications + email in the wrong company).
        if (assigned_to && companyId !== undefined && !(await userIsInCompany(assigned_to, companyId))) {
            res.status(400).json({ error: tError(req, 'assignee_not_in_company') });
            return;
        }

        // Atomic order_index: single query avoids race condition with concurrent inserts
        const { rows } = await pool.query(
            `INSERT INTO subtasks (task_id, title, assigned_to, order_index, due_date, priority, company_id)
       VALUES ($1, $2, $3,
               COALESCE((SELECT MAX(order_index) FROM subtasks WHERE task_id = $1 AND deleted_at IS NULL), -1) + 1,
               $4, $5, $6) RETURNING *`,
            [taskId, title, assigned_to || null, due_date || null, priority || 'medium', companyId]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
       VALUES ($1, $2, 'subtask_added', $3, $4)`,
            [taskId, req.user!.id, JSON.stringify({ subtask_title: title }), companyId]
        );

        // Get user info if assigned
        if (assigned_to) {
            const { rows: userRows } = await pool.query(
                'SELECT display_name, avatar_url FROM users WHERE id = $1',
                [assigned_to]
            );
            if (userRows.length > 0) {
                rows[0].assigned_to_name = userRows[0].display_name;
                rows[0].assigned_to_avatar = userRows[0].avatar_url;
            }

            await pool.query(
                `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
         VALUES ($1, $2, 'subtask_assigned', $3, $4)`,
                [taskId, req.user!.id, JSON.stringify({
                    subtask_title: title,
                    assigned_to: assigned_to,
                    assigned_to_name: userRows[0]?.display_name
                }), companyId]
            );

            // NOTIFICATION: notify the assigned user (if different from assigner)
            if (assigned_to !== req.user!.id) {
                try {
                    const payload = { actor: req.user!.display_name, subtaskTitle: title };
                    await pool.query(
                        `INSERT INTO notifications (user_id, task_id, type, message, payload, created_by, company_id)
                         VALUES ($1, $2, 'subtask_assigned', $3, $4, $5, $6)`,
                        [assigned_to, taskId,
                            `${req.user!.display_name} ți-a atribuit o sub-sarcină: "${title}"`,
                            JSON.stringify(payload),
                            req.user!.id,
                            companyId]
                    );
                } catch (notifErr) {
                    console.error('Notification error (non-critical):', notifErr);
                }

                // EMAIL: notify subtask assignee (fire-and-forget)
                (async () => {
                    try {
                        const { rows: taskRows } = await pool.query('SELECT title FROM tasks WHERE id = $1', [taskId]);
                        const taskTitle = taskRows[0]?.title || 'Sarcină';
                        const stakeholders = await getSpecificStakeholders([assigned_to], req.user!.id);
                        for (const user of stakeholders) {
                            const language = await resolveRecipientLocale(user.id, companyId);
                            const actor = req.user!.display_name;
                            const htmlBody = buildNotificationHtml({
                                recipientName: user.display_name,
                                subtitle: tServer(language, 'notif_email.sub_subtask_assigned'),
                                bodyLines: [
                                    `<p style="color: #555; font-size: 14px;">${tServer(language, 'notif_email.body_user_assigned_subtask', { actor })}</p>`,
                                    `<p style="color: #333; font-size: 14px; font-weight: bold; margin: 8px 0;">📌 ${title}</p>`,
                                ],
                                taskId,
                                taskTitle,
                                language,
                                companyId,
                            });
                            sendNotificationEmail({
                                userId: user.id, userEmail: user.email, userName: user.display_name,
                                taskId, subject: tServer(language, 'notif_email.subj_subtask_assigned', { title }),
                                htmlBody, emailType: 'subtask_assigned',
                                companyId,
                            }).catch(err => console.error('[subtask_assigned] Email error:', err));
                        }
                    } catch (err) {
                        console.error('[subtask_assigned] Email notification error:', err);
                    }
                })();
            }
        }

    res.status(201).json(rows[0]);
}));

// PUT /api/tasks/:id/subtasks/:subtaskId
router.put('/subtasks/:subtaskId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId } = req.params;
        const { title, is_completed, assigned_to, due_date, priority } = req.body;
        const companyId = req.activeCompanyId;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
            res.status(403).json({ error: tError(req, 'task_no_permission') });
            return;
        }

        if (companyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }

        // Tenant guard: subtask must belong to :taskId AND active company
        const oldSubtask = await getSubtaskInTenant(subtaskId, taskId, companyId);
        if (!oldSubtask) {
            res.status(404).json({ error: tError(req, 'subtask_not_found') });
            return;
        }
        const oldRows = [oldSubtask];

        // Tenant guard on assigned_to (audit-3 C11): reject UUIDs from other tenants.
        if (assigned_to && companyId !== undefined && !(await userIsInCompany(assigned_to, companyId))) {
            res.status(400).json({ error: tError(req, 'assignee_not_in_company') });
            return;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (is_completed !== undefined) {
            updates.push(`is_completed = $${paramIndex++}`);
            values.push(is_completed);

            // Log completion
            if (is_completed !== oldRows[0].is_completed) {
                await pool.query(
                    `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
           VALUES ($1, $2, 'subtask_completed', $3, $4)`,
                    [taskId, req.user!.id, JSON.stringify({
                        subtask_title: oldRows[0].title,
                        completed: is_completed
                    }), companyId]
                );

                // EMAIL: subtask completed (false → true only)
                if (is_completed === true && oldRows[0].is_completed === false) {
                    (async () => {
                        try {
                            const { rows: taskRows } = await pool.query('SELECT title, created_by, assigned_to FROM tasks WHERE id = $1', [taskId]);
                            const task = taskRows[0];
                            if (!task) return;
                            const recipientIds = [task.created_by, task.assigned_to, oldRows[0].assigned_to];
                            const stakeholders = await getSpecificStakeholders(recipientIds, req.user!.id);
                            for (const user of stakeholders) {
                                const language = await resolveRecipientLocale(user.id, companyId);
                                const actor = req.user!.display_name;
                                const htmlBody = buildNotificationHtml({
                                    recipientName: user.display_name,
                                    subtitle: tServer(language, 'notif_email.sub_subtask_completed'),
                                    bodyLines: [
                                        `<p style="color: #555; font-size: 14px;">${tServer(language, 'notif_email.body_user_completed_subtask', { actor })}</p>`,
                                        `<p style="color: #065f46; font-size: 14px; font-weight: bold; margin: 8px 0;">✅ ${oldRows[0].title}</p>`,
                                    ],
                                    taskId,
                                    taskTitle: task.title,
                                    language,
                                    companyId,
                                });
                                sendNotificationEmail({
                                    userId: user.id, userEmail: user.email, userName: user.display_name,
                                    taskId, subject: tServer(language, 'notif_email.subj_subtask_completed', { title: oldRows[0].title }),
                                    htmlBody, emailType: 'subtask_completed',
                                    companyId,
                                }).catch(err => console.error('[subtask_completed] Email error:', err));
                            }
                        } catch (err) {
                            console.error('[subtask_completed] Email notification error:', err);
                        }
                    })();
                }
            }
        }
        if (assigned_to !== undefined) {
            updates.push(`assigned_to = $${paramIndex++}`);
            values.push(assigned_to || null);

            // Log assignment
            if (assigned_to !== oldRows[0].assigned_to) {
                let assignedName = null;
                if (assigned_to) {
                    const { rows: userRows } = await pool.query(
                        'SELECT display_name FROM users WHERE id = $1', [assigned_to]
                    );
                    assignedName = userRows[0]?.display_name;
                }

                await pool.query(
                    `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
           VALUES ($1, $2, 'subtask_assigned', $3, $4)`,
                    [taskId, req.user!.id, JSON.stringify({
                        subtask_title: oldRows[0].title,
                        assigned_to: assigned_to,
                        assigned_to_name: assignedName
                    }), companyId]
                );

                // IN-APP NOTIFICATION: subtask reassigned (mirrors the POST path).
                // Without this, the bell stays empty even though the email is sent.
                if (assigned_to && assigned_to !== req.user!.id) {
                    try {
                        const payload = { actor: req.user!.display_name, subtaskTitle: oldRows[0].title };
                        await pool.query(
                            `INSERT INTO notifications (user_id, task_id, type, message, payload, created_by, company_id)
                             VALUES ($1, $2, 'subtask_assigned', $3, $4, $5, $6)`,
                            [assigned_to, taskId,
                                `${req.user!.display_name} ți-a atribuit o sub-sarcină: "${oldRows[0].title}"`,
                                JSON.stringify(payload),
                                req.user!.id,
                                companyId]
                        );
                    } catch (notifErr) {
                        console.error('Notification error (non-critical):', notifErr);
                    }
                }

                // EMAIL: subtask reassigned
                if (assigned_to && assigned_to !== req.user!.id) {
                    (async () => {
                        try {
                            const { rows: taskRows } = await pool.query('SELECT title FROM tasks WHERE id = $1', [taskId]);
                            const taskTitle = taskRows[0]?.title || 'Sarcină';
                            const stakeholders = await getSpecificStakeholders([assigned_to], req.user!.id);
                            for (const user of stakeholders) {
                                const language = await resolveRecipientLocale(user.id, companyId);
                                const actor = req.user!.display_name;
                                const htmlBody = buildNotificationHtml({
                                    recipientName: user.display_name,
                                    subtitle: tServer(language, 'notif_email.sub_subtask_assigned'),
                                    bodyLines: [
                                        `<p style="color: #555; font-size: 14px;">${tServer(language, 'notif_email.body_user_assigned_subtask', { actor })}</p>`,
                                        `<p style="color: #333; font-size: 14px; font-weight: bold; margin: 8px 0;">📌 ${oldRows[0].title}</p>`,
                                    ],
                                    taskId,
                                    taskTitle,
                                    language,
                                    companyId,
                                });
                                sendNotificationEmail({
                                    userId: user.id, userEmail: user.email, userName: user.display_name,
                                    taskId, subject: tServer(language, 'notif_email.subj_subtask_assigned', { title: oldRows[0].title }),
                                    htmlBody, emailType: 'subtask_assigned',
                                    companyId,
                                }).catch(err => console.error('[subtask_assigned] Email error:', err));
                            }
                        } catch (err) {
                            console.error('[subtask_assigned] Email notification error:', err);
                        }
                    })();
                }
            }
        }
        if (due_date !== undefined) {
            updates.push(`due_date = $${paramIndex++}`);
            values.push(due_date || null);
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramIndex++}`);
            values.push(priority);
        }

        if (updates.length === 0) {
            res.status(400).json({ error: tError(req, 'nothing_to_update') });
            return;
        }

        updates.push('updated_at = NOW()');
        values.push(subtaskId, taskId);

        const { rows } = await pool.query(
            `UPDATE subtasks SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND task_id = $${paramIndex + 1}
       RETURNING *`,
            values
        );

        // Get assigned user info
        if (rows[0]?.assigned_to) {
            const { rows: userRows } = await pool.query(
                'SELECT display_name, avatar_url FROM users WHERE id = $1',
                [rows[0].assigned_to]
            );
            if (userRows.length > 0) {
                rows[0].assigned_to_name = userRows[0].display_name;
                rows[0].assigned_to_avatar = userRows[0].avatar_url;
            }
        }

    res.json(rows[0]);
}));

// PUT /api/tasks/:id/subtasks-reorder
router.put('/subtasks-reorder', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;
        const { order } = req.body; // Array of { id, order_index }

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
            res.status(403).json({ error: tError(req, 'task_no_permission') });
            return;
        }

        if (!order || !Array.isArray(order)) {
            res.status(400).json({ error: tError(req, 'order_required') });
            return;
        }

        const ids = order.map((o: { id: string; order_index: number }) => o.id);
        const indices = order.map((o: { id: string; order_index: number }) => o.order_index);

        await pool.query(`
            UPDATE subtasks s
            SET order_index = v.new_order, updated_at = NOW()
            FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS new_order) v
            WHERE s.id = v.id AND s.task_id = $3
        `, [ids, indices, taskId]);

    res.json({ message: 'Ordinea a fost actualizată.' });
}));

// DELETE /api/tasks/:id/subtasks/:subtaskId
router.delete('/subtasks/:subtaskId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId } = req.params;
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
        const subtask = await getSubtaskInTenant(subtaskId, taskId, companyId);
        if (!subtask) {
            res.status(404).json({ error: tError(req, 'subtask_not_found') });
            return;
        }

        const { rows } = await pool.query(
            'UPDATE subtasks SET deleted_at = NOW() WHERE id = $1 AND task_id = $2 AND deleted_at IS NULL RETURNING *',
            [subtaskId, taskId]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: tError(req, 'subtask_not_found') });
            return;
        }

    res.status(204).send();
}));

// ============================================================
// SUBTASK COMMENTS
// ============================================================
// Hungary's umbrella-style workflow: subtasks are the unit of work, so
// comments need to live ON the subtask, not on the parent task. Mirrors the
// task_comments shape but scoped to subtask_id.

// GET /api/tasks/:id/subtasks/:subtaskId/comments
router.get('/subtasks/:subtaskId/comments', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId } = req.params;
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    const subtask = await getSubtaskInTenant(subtaskId, taskId, companyId);
    if (!subtask) {
        res.status(404).json({ error: tError(req, 'subtask_not_found') });
        return;
    }
    const { rows } = await pool.query(
        `SELECT c.id, c.subtask_id, c.author_id, c.content, c.mentions,
                c.created_at, c.updated_at,
                u.display_name AS author_name, u.avatar_url AS author_avatar
         FROM subtask_comments c
         JOIN users u ON c.author_id = u.id
         WHERE c.subtask_id = $1 AND c.company_id = $2
         ORDER BY c.created_at ASC`,
        [subtaskId, companyId]
    );
    res.json(rows);
}));

// POST /api/tasks/:id/subtasks/:subtaskId/comments
router.post('/subtasks/:subtaskId/comments', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId } = req.params;
    const { content } = req.body as { content?: string };
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    const subtask = await getSubtaskInTenant(subtaskId, taskId, companyId);
    if (!subtask) {
        res.status(404).json({ error: tError(req, 'subtask_not_found') });
        return;
    }
    if (!content || !content.trim()) {
        res.status(400).json({ error: tError(req, 'comment_content_required') });
        return;
    }
    const { rows } = await pool.query(
        `INSERT INTO subtask_comments (subtask_id, author_id, content, company_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, subtask_id, author_id, content, mentions, created_at, updated_at`,
        [subtaskId, req.user!.id, content.trim(), companyId]
    );
    const { rows: u } = await pool.query(
        'SELECT display_name, avatar_url FROM users WHERE id = $1',
        [req.user!.id]
    );

    // Notify the subtask owner (if any, not the commenter themselves).
    if (subtask.assigned_to && subtask.assigned_to !== req.user!.id) {
        const payload = { actor: req.user!.display_name, subtaskTitle: subtask.title };
        await pool.query(
            `INSERT INTO notifications (user_id, task_id, type, message, payload, created_by, company_id)
             VALUES ($1, $2, 'subtask_comment', $3, $4, $5, $6)`,
            [subtask.assigned_to, taskId,
                `${req.user!.display_name} a comentat pe sub-sarcina: "${subtask.title}"`,
                JSON.stringify(payload), req.user!.id, companyId]
        );
    }

    res.status(201).json({
        ...rows[0],
        author_name: u[0]?.display_name,
        author_avatar: u[0]?.avatar_url,
    });
}));

// DELETE /api/tasks/:id/subtasks/:subtaskId/comments/:commentId
router.delete('/subtasks/:subtaskId/comments/:commentId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId, commentId } = req.params;
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    // Only the author (or an admin) can delete.
    const { rows: existing } = await pool.query(
        `SELECT author_id FROM subtask_comments
         WHERE id = $1 AND subtask_id = $2 AND company_id = $3`,
        [commentId, subtaskId, companyId]
    );
    if (existing.length === 0) {
        res.status(404).json({ error: tError(req, 'comment_not_found') });
        return;
    }
    const isAuthor = existing[0].author_id === req.user!.id;
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
    if (!isAuthor && !isAdmin) {
        res.status(403).json({ error: tError(req, 'comment_not_yours') });
        return;
    }
    await pool.query(
        `DELETE FROM subtask_comments WHERE id = $1 AND company_id = $2`,
        [commentId, companyId]
    );
    res.status(204).send();
}));

// ============================================================
// SUBTASK ATTACHMENTS
// ============================================================
// File metadata only — the actual blob storage uses the existing /api/upload
// endpoint which already enforces tenant + size limits. The client posts to
// /api/upload first, gets back a URL, then registers the file here.

// GET /api/tasks/:id/subtasks/:subtaskId/attachments
router.get('/subtasks/:subtaskId/attachments', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId } = req.params;
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    const subtask = await getSubtaskInTenant(subtaskId, taskId, companyId);
    if (!subtask) {
        res.status(404).json({ error: tError(req, 'subtask_not_found') });
        return;
    }
    const { rows } = await pool.query(
        `SELECT a.id, a.subtask_id, a.file_name, a.file_url, a.file_size,
                a.uploaded_by, a.created_at,
                u.display_name AS uploaded_by_name
         FROM subtask_attachments a
         JOIN users u ON a.uploaded_by = u.id
         WHERE a.subtask_id = $1 AND a.company_id = $2
         ORDER BY a.created_at DESC`,
        [subtaskId, companyId]
    );
    res.json(rows);
}));

// POST /api/tasks/:id/subtasks/:subtaskId/attachments
router.post('/subtasks/:subtaskId/attachments', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId } = req.params;
    const { file_name, file_url, file_size } = req.body as {
        file_name?: string; file_url?: string; file_size?: number;
    };
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    const subtask = await getSubtaskInTenant(subtaskId, taskId, companyId);
    if (!subtask) {
        res.status(404).json({ error: tError(req, 'subtask_not_found') });
        return;
    }
    if (!file_name || !file_url || typeof file_size !== 'number') {
        res.status(400).json({ error: tError(req, 'attachment_fields_required') });
        return;
    }
    const { rows } = await pool.query(
        `INSERT INTO subtask_attachments (subtask_id, file_name, file_url, file_size, uploaded_by, company_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [subtaskId, file_name, file_url, file_size, req.user!.id, companyId]
    );
    res.status(201).json(rows[0]);
}));

// DELETE /api/tasks/:id/subtasks/:subtaskId/attachments/:attachmentId
router.delete('/subtasks/:subtaskId/attachments/:attachmentId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, subtaskId, attachmentId } = req.params;
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: tError(req, 'task_no_permission') });
        return;
    }
    await pool.query(
        `DELETE FROM subtask_attachments
         WHERE id = $1 AND subtask_id = $2 AND company_id = $3`,
        [attachmentId, subtaskId, companyId]
    );
    res.status(204).send();
}));

export default router;
