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
                    await pool.query(
                        `INSERT INTO notifications (user_id, task_id, type, message, created_by, company_id)
                         VALUES ($1, $2, 'subtask_assigned', $3, $4, $5)`,
                        [assigned_to, taskId,
                            `${req.user!.display_name} ți-a atribuit o sub-sarcină: "${title}"`,
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
                        await pool.query(
                            `INSERT INTO notifications (user_id, task_id, type, message, created_by, company_id)
                             VALUES ($1, $2, 'subtask_assigned', $3, $4, $5)`,
                            [assigned_to, taskId,
                                `${req.user!.display_name} ți-a atribuit o sub-sarcină: "${oldRows[0].title}"`,
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

export default router;
