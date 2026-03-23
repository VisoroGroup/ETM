import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/tasks/:id/subtasks
router.post('/subtasks', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { title, assigned_to, due_date, priority } = req.body;

        if (!title) {
            res.status(400).json({ error: 'Titlul subtask-ului este obligatoriu.' });
            return;
        }

        // Get max order_index
        const { rows: maxRows } = await pool.query(
            'SELECT COALESCE(MAX(order_index), -1) AS max_index FROM subtasks WHERE task_id = $1',
            [taskId]
        );
        const orderIndex = maxRows[0].max_index + 1;

        const { rows } = await pool.query(
            `INSERT INTO subtasks (task_id, title, assigned_to, order_index, due_date, priority)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [taskId, title, assigned_to || null, orderIndex, due_date || null, priority || 'medium']
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'subtask_added', $3)`,
            [taskId, req.user!.id, JSON.stringify({ subtask_title: title })]
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
                `INSERT INTO activity_log (task_id, user_id, action_type, details)
         VALUES ($1, $2, 'subtask_assigned', $3)`,
                [taskId, req.user!.id, JSON.stringify({
                    subtask_title: title,
                    assigned_to: assigned_to,
                    assigned_to_name: userRows[0]?.display_name
                })]
            );

            // NOTIFICATION: notify the assigned user (if different from assigner)
            if (assigned_to !== req.user!.id) {
                try {
                    await pool.query(
                        `INSERT INTO notifications (user_id, task_id, type, message, created_by)
                         VALUES ($1, $2, 'subtask_assigned', $3, $4)`,
                        [assigned_to, taskId,
                            `${req.user!.display_name} ți-a atribuit o sub-sarcină: "${title}"`,
                            req.user!.id]
                    );
                } catch (notifErr) {
                    console.error('Notification error (non-critical):', notifErr);
                }

                // EMAIL: notify subtask assignee
                import('../services/notificationEmailService').then(({ getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail }) => {
                    // Get task title for the email
                    pool.query('SELECT title FROM tasks WHERE id = $1', [taskId]).then(({ rows: taskRows }) => {
                        const taskTitle = taskRows[0]?.title || 'Sarcină';
                        getSpecificStakeholders([assigned_to], req.user!.id).then(stakeholders => {
                            for (const user of stakeholders) {
                                const htmlBody = buildNotificationHtml({
                                    recipientName: user.display_name,
                                    subtitle: 'Sub-sarcină atribuită',
                                    bodyLines: [
                                        `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> ți-a atribuit o sub-sarcină:</p>`,
                                        `<p style="color: #333; font-size: 14px; font-weight: bold; margin: 8px 0;">📌 ${title}</p>`,
                                    ],
                                    taskId,
                                    taskTitle,
                                });
                                sendNotificationEmail({
                                    userId: user.id, userEmail: user.email, userName: user.display_name,
                                    taskId, subject: `[ETM] Sub-sarcină atribuită — ${title}`,
                                    htmlBody, emailType: 'subtask_assigned',
                                }).catch(err => console.error('[subtask_assigned] Email error:', err));
                            }
                        }).catch(err => console.error('[subtask_assigned] Stakeholder error:', err));
                    }).catch(err => console.error('[subtask_assigned] Task query error:', err));
                }).catch(err => console.error('[subtask_assigned] Import error:', err));
            }
        }

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating subtask:', err);
        res.status(500).json({ error: 'Eroare la crearea subtask-ului.' });
    }
});

// PUT /api/tasks/:id/subtasks/:subtaskId
router.put('/subtasks/:subtaskId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId, subtaskId } = req.params;
        const { title, is_completed, assigned_to, due_date, priority } = req.body;

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        // Get old values for logging
        const { rows: oldRows } = await pool.query(
            'SELECT * FROM subtasks WHERE id = $1 AND task_id = $2',
            [subtaskId, taskId]
        );

        if (oldRows.length === 0) {
            res.status(404).json({ error: 'Subtask-ul nu a fost găsit.' });
            return;
        }

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
                    `INSERT INTO activity_log (task_id, user_id, action_type, details)
           VALUES ($1, $2, 'subtask_completed', $3)`,
                    [taskId, req.user!.id, JSON.stringify({
                        subtask_title: oldRows[0].title,
                        completed: is_completed
                    })]
                );

                // EMAIL: subtask completed (false → true only)
                if (is_completed === true && oldRows[0].is_completed === false) {
                    import('../services/notificationEmailService').then(({ getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail }) => {
                        pool.query('SELECT title, created_by, assigned_to FROM tasks WHERE id = $1', [taskId]).then(({ rows: taskRows }) => {
                            const task = taskRows[0];
                            if (!task) return;
                            // Scoped: task created_by + task assigned_to + this subtask's assigned_to
                            const recipientIds = [task.created_by, task.assigned_to, oldRows[0].assigned_to];
                            getSpecificStakeholders(recipientIds, req.user!.id).then(stakeholders => {
                                for (const user of stakeholders) {
                                    const htmlBody = buildNotificationHtml({
                                        recipientName: user.display_name,
                                        subtitle: 'Sub-sarcină finalizată',
                                        bodyLines: [
                                            `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> a finalizat o sub-sarcină:</p>`,
                                            `<p style="color: #065f46; font-size: 14px; font-weight: bold; margin: 8px 0;">✅ ${oldRows[0].title}</p>`,
                                        ],
                                        taskId,
                                        taskTitle: task.title,
                                    });
                                    sendNotificationEmail({
                                        userId: user.id, userEmail: user.email, userName: user.display_name,
                                        taskId, subject: `[ETM] Sub-sarcină finalizată — ${oldRows[0].title}`,
                                        htmlBody, emailType: 'subtask_completed',
                                    }).catch(err => console.error('[subtask_completed] Email error:', err));
                                }
                            }).catch(err => console.error('[subtask_completed] Stakeholder error:', err));
                        }).catch(err => console.error('[subtask_completed] Task query error:', err));
                    }).catch(err => console.error('[subtask_completed] Import error:', err));
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
                    `INSERT INTO activity_log (task_id, user_id, action_type, details)
           VALUES ($1, $2, 'subtask_assigned', $3)`,
                    [taskId, req.user!.id, JSON.stringify({
                        subtask_title: oldRows[0].title,
                        assigned_to: assigned_to,
                        assigned_to_name: assignedName
                    })]
                );

                // EMAIL: subtask reassigned
                if (assigned_to && assigned_to !== req.user!.id) {
                    import('../services/notificationEmailService').then(({ getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail }) => {
                        pool.query('SELECT title FROM tasks WHERE id = $1', [taskId]).then(({ rows: taskRows }) => {
                            const taskTitle = taskRows[0]?.title || 'Sarcină';
                            getSpecificStakeholders([assigned_to], req.user!.id).then(stakeholders => {
                                for (const user of stakeholders) {
                                    const htmlBody = buildNotificationHtml({
                                        recipientName: user.display_name,
                                        subtitle: 'Sub-sarcină atribuită',
                                        bodyLines: [
                                            `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> ți-a atribuit o sub-sarcină:</p>`,
                                            `<p style="color: #333; font-size: 14px; font-weight: bold; margin: 8px 0;">📌 ${oldRows[0].title}</p>`,
                                        ],
                                        taskId,
                                        taskTitle,
                                    });
                                    sendNotificationEmail({
                                        userId: user.id, userEmail: user.email, userName: user.display_name,
                                        taskId, subject: `[ETM] Sub-sarcină atribuită — ${oldRows[0].title}`,
                                        htmlBody, emailType: 'subtask_assigned',
                                    }).catch(err => console.error('[subtask_assigned] Email error:', err));
                                }
                            }).catch(err => console.error('[subtask_assigned] Stakeholder error:', err));
                        }).catch(err => console.error('[subtask_assigned] Task query error:', err));
                    }).catch(err => console.error('[subtask_assigned] Import error:', err));
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
            res.status(400).json({ error: 'Nimic de actualizat.' });
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
    } catch (err) {
        console.error('Error updating subtask:', err);
        res.status(500).json({ error: 'Eroare la actualizarea subtask-ului.' });
    }
});

// PUT /api/tasks/:id/subtasks-reorder
router.put('/subtasks-reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { order } = req.body; // Array of { id, order_index }

        if (!order || !Array.isArray(order)) {
            res.status(400).json({ error: 'Ordinea este obligatorie.' });
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
    } catch (err) {
        console.error('Error reordering subtasks:', err);
        res.status(500).json({ error: 'Eroare la reordonarea subtask-urilor.' });
    }
});

// DELETE /api/tasks/:id/subtasks/:subtaskId
router.delete('/subtasks/:subtaskId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId, subtaskId } = req.params;
        const { rows } = await pool.query(
            'UPDATE subtasks SET deleted_at = NOW() WHERE id = $1 AND task_id = $2 AND deleted_at IS NULL RETURNING *',
            [subtaskId, taskId]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Subtask-ul nu a fost găsit.' });
            return;
        }

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Eroare la ștergerea subtask-ului.' });
    }
});

export default router;
