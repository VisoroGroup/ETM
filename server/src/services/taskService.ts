import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus } from '../types';
import { dispatchWebhook } from './webhookService';
import { getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail } from './notificationEmailService';

// ------- GET /:id — full task detail with related data -------

export async function getTaskById(id: string) {
    const { rows: taskRows } = await pool.query(
        `SELECT t.*, u.display_name AS creator_name, u.avatar_url AS creator_avatar,
        au.display_name AS assignee_name, au.avatar_url AS assignee_avatar, au.email AS assignee_email,
        CASE WHEN rt.id IS NOT NULL AND rt.is_active = true THEN true ELSE false END AS is_recurring,
        rt.frequency AS recurring_frequency,
        (SELECT tsc.reason FROM task_status_changes tsc
         WHERE tsc.task_id = t.id AND tsc.new_status = 'blocat'
         ORDER BY tsc.created_at DESC LIMIT 1) AS blocked_reason
       FROM tasks t
       JOIN users u ON t.created_by = u.id
       LEFT JOIN users au ON t.assigned_to = au.id
       LEFT JOIN recurring_tasks rt ON rt.template_task_id = t.id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
        [id]
    );

    if (taskRows.length === 0) return null;

    // Run all sub-queries in parallel (they only depend on task id)
    const [
        { rows: subtasks },
        { rows: comments },
        { rows: attachments },
        { rows: activity },
        { rows: alerts },
        { rows: allDeps },
        { rows: checklist }
    ] = await Promise.all([
        pool.query(
            `SELECT s.*, u.display_name AS assigned_to_name, u.avatar_url AS assigned_to_avatar
       FROM subtasks s
       LEFT JOIN users u ON s.assigned_to = u.id
       WHERE s.task_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.order_index`,
            [id]
        ),
        pool.query(
            `SELECT c.*, u.display_name AS author_name, u.avatar_url AS author_avatar
       FROM task_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at DESC
       LIMIT 20`,
            [id]
        ),
        pool.query(
            `SELECT a.*, u.display_name AS uploader_name
       FROM task_attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.task_id = $1
       ORDER BY a.created_at DESC`,
            [id]
        ),
        pool.query(
            `SELECT al.*, u.display_name AS user_name, u.avatar_url AS user_avatar
       FROM activity_log al
       JOIN users u ON al.user_id = u.id
       WHERE al.task_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
            [id]
        ),
        pool.query(
            `SELECT a.*,
               uc.display_name AS creator_name, uc.avatar_url AS creator_avatar,
               ur.display_name AS resolved_by_name
             FROM task_alerts a
             JOIN users uc ON a.created_by = uc.id
             LEFT JOIN users ur ON a.resolved_by = ur.id
             WHERE a.task_id = $1
             ORDER BY a.created_at DESC`,
            [id]
        ),
        pool.query(
            `SELECT td.*,
               bt.title AS blocking_task_title, bt.status AS blocking_task_status,
               bdt.title AS blocked_task_title, bdt.status AS blocked_task_status,
               u.display_name AS creator_name
             FROM task_dependencies td
             JOIN tasks bt ON td.blocking_task_id = bt.id
             JOIN tasks bdt ON td.blocked_task_id = bdt.id
             JOIN users u ON td.created_by = u.id
             WHERE (td.blocking_task_id = $1 OR td.blocked_task_id = $1)
             ORDER BY td.created_at DESC`,
            [id]
        ),
        pool.query(
            `SELECT * FROM task_checklist_items WHERE task_id = $1 ORDER BY order_index ASC`,
            [id]
        )
    ]);

    return {
        ...taskRows[0],
        subtasks,
        comments: comments.reverse(),
        attachments,
        activity,
        alerts,
        dependencies: {
            blocks: allDeps.filter(d => d.blocking_task_id === id),
            blocked_by: allDeps.filter(d => d.blocked_task_id === id),
        },
        checklist,
    };
}

// ------- POST / — create task -------

export async function createTask(
    data: { title: string; description?: string; due_date: string; department_label: string; assigned_to?: string },
    userId: string
) {
    const { title, description, due_date, department_label, assigned_to } = data;
    const taskId = uuidv4();

    const { rows } = await pool.query(
        `INSERT INTO tasks (id, title, description, due_date, created_by, department_label, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
        [taskId, title, description || null, due_date, userId, department_label, assigned_to || null]
    );

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'created', $3)`,
        [taskId, userId, JSON.stringify({ title, description, department_label, assigned_to, due_date })]
    );

    // Webhook: task.created
    dispatchWebhook('task.created', {
        task: rows[0],
        actor: { id: userId }
    }).catch(err => console.error('[WEBHOOK] task.created dispatch error:', err.message));

    return rows[0];
}

// ------- PUT /:id — update task -------

export async function updateTask(
    id: string,
    data: { title?: string; description?: string; department_label?: string; assigned_to?: string },
    userId: string
) {
    // Fetch old task for audit comparison
    const { rows: oldRows } = await pool.query('SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (oldRows.length === 0) return undefined;
    const oldTask = oldRows[0];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(data.title);
    }
    if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
    }
    if (data.department_label !== undefined) {
        updates.push(`department_label = $${paramIndex++}`);
        values.push(data.department_label);
    }
    if (data.assigned_to !== undefined) {
        updates.push(`assigned_to = $${paramIndex++}`);
        values.push(data.assigned_to || null);
    }

    if (updates.length === 0) return null; // Nothing to update

    updates.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await pool.query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    if (rows.length === 0) return undefined;

    // --- Audit logging: log each field change separately ---
    if (data.title !== undefined && data.title !== oldTask.title) {
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'title_changed', $3)`,
            [id, userId, JSON.stringify({ old_value: oldTask.title, new_value: data.title })]
        );
    }
    if (data.description !== undefined && data.description !== oldTask.description) {
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'description_changed', $3)`,
            [id, userId, JSON.stringify({
                old_value: (oldTask.description || '').substring(0, 200),
                new_value: (data.description || '').substring(0, 200)
            })]
        );
    }
    if (data.department_label !== undefined && data.department_label !== oldTask.department_label) {
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'department_changed', $3)`,
            [id, userId, JSON.stringify({ old_value: oldTask.department_label, new_value: data.department_label })]
        );
    }
    if (data.assigned_to !== undefined && (data.assigned_to || null) !== oldTask.assigned_to) {
        let oldName = null, newName = null;
        if (oldTask.assigned_to) {
            const { rows: u } = await pool.query('SELECT display_name FROM users WHERE id = $1', [oldTask.assigned_to]);
            oldName = u[0]?.display_name;
        }
        if (data.assigned_to) {
            const { rows: u } = await pool.query('SELECT display_name FROM users WHERE id = $1', [data.assigned_to]);
            newName = u[0]?.display_name;
        }
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'assigned_to_changed', $3)`,
            [id, userId, JSON.stringify({ old_value: oldTask.assigned_to, old_name: oldName, new_value: data.assigned_to || null, new_name: newName })]
        );
        // Notification to new assignee
        if (data.assigned_to && data.assigned_to !== userId) {
            const { rows: creator } = await pool.query('SELECT display_name FROM users WHERE id = $1', [userId]);
            const creatorName = creator[0]?.display_name || 'Cineva';
            await pool.query(
                `INSERT INTO notifications (user_id, task_id, type, message, created_by)
                 VALUES ($1, $2, 'task_assigned', $3, $4)`,
                [data.assigned_to, id, `${creatorName} ți-a atribuit sarcina: "${data.title || oldTask.title}"`, userId]
            );

            // EMAIL: notify new assignee (fire-and-forget)
            (async () => {
                try {
                    const stakeholders = await getSpecificStakeholders([data.assigned_to!], userId);
                    const taskTitle = data.title || oldTask.title;
                    for (const user of stakeholders) {
                        const htmlBody = buildNotificationHtml({
                            recipientName: user.display_name,
                            subtitle: 'Sarcină atribuită',
                            bodyLines: [
                                `<p style="color: #555; font-size: 14px;"><strong>${creatorName}</strong> ți-a atribuit o sarcină:</p>`,
                            ],
                            taskId: id,
                            taskTitle,
                        });
                        sendNotificationEmail({
                            userId: user.id, userEmail: user.email, userName: user.display_name,
                            taskId: id, subject: `[ETM] Sarcină atribuită — ${taskTitle}`,
                            htmlBody, emailType: 'task_assigned',
                        }).catch(err => console.error('[task_assigned] Email error:', err));
                    }
                } catch (err) {
                    console.error('[task_assigned] Email notification error:', err);
                }
            })();
        }
        // Webhook: task.assigned
        dispatchWebhook('task.assigned', {
            task: rows[0],
            actor: { id: userId },
            changes: { old_assigned_to: oldTask.assigned_to, new_assigned_to: data.assigned_to || null }
        }).catch(err => console.error('[WEBHOOK] task.assigned dispatch error:', err.message));
    }

    return rows[0];
}

// ------- DELETE /:id — soft delete -------

export async function softDeleteTask(id: string, userId: string, userRole: string) {
    const { rows } = await pool.query('SELECT created_by, title FROM tasks WHERE id = $1', [id]);
    if (rows.length === 0) return { error: 'not_found' as const };

    console.log('[DELETE DEBUG]', {
        taskId: id,
        userId,
        userRole,
        created_by: rows[0]?.created_by,
        match: rows[0]?.created_by === userId
    });

    if (rows[0].created_by !== userId && userRole !== 'admin') {
        return { error: 'forbidden' as const };
    }

    // Audit log: task deleted
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'task_deleted', $3)`,
        [id, userId, JSON.stringify({ title: rows[0].title })]
    );

    await pool.query('UPDATE tasks SET deleted_at = NOW() WHERE id = $1', [id]);
    return { success: true };
}

// ------- POST /:id/duplicate — duplicate task with subtasks -------

export async function duplicateTask(id: string, userId: string) {
    const { rows: [original] } = await pool.query(
        'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!original) return null;

    const newId = uuidv4();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    await pool.query(
        `INSERT INTO tasks (id, title, description, status, due_date, created_by, department_label)
         VALUES ($1, $2, $3, 'de_rezolvat', $4, $5, $6)`,
        [newId, `${original.title} (copie)`, original.description, dueDate.toISOString().split('T')[0], userId, original.department_label]
    );

    // Copy subtasks (reset checkboxes, clear assigned_to)
    const { rows: subtasks } = await pool.query(
        'SELECT title, order_index FROM subtasks WHERE task_id = $1 ORDER BY order_index', [id]
    );
    for (const st of subtasks) {
        await pool.query(
            'INSERT INTO subtasks (task_id, title, is_completed, assigned_to, order_index) VALUES ($1, $2, false, NULL, $3)',
            [newId, st.title, st.order_index]
        );
    }

    // Activity log on new task
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'created', $3)`,
        [newId, userId, JSON.stringify({ duplicated_from: id, original_title: original.title })]
    );

    // Activity log on original task
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'created', $3)`,
        [id, userId, JSON.stringify({ duplicated_to: newId })]
    );

    const { rows: [newTask] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [newId]);
    return newTask;
}
