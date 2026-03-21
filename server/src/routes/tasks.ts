import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus } from '../types';
import { validateCreateTask, validateUpdateTask, validateChangeStatus } from '../middleware/validation';
import taskSubtaskRoutes from './taskSubtasks';
import taskCommentRoutes from './taskComments';
import taskAttachmentRoutes from './taskAttachments';
import taskActivityRoutes from './taskActivity';
import taskRecurringRoutes from './taskRecurring';
import taskAlertRoutes from './taskAlerts';

const router = Router();

// GET /api/tasks — list tasks with filters
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const {
            status,
            department,
            search,
            period,
            recurring,
            assigned_to,
            page = '1',
            limit = '50'
        } = req.query;

        const conditions: string[] = ['t.deleted_at IS NULL'];
        const values: any[] = [];
        let paramIndex = 1;

        // Status filter (multi-select, comma separated)
        if (status) {
            const statuses = (status as string).split(',');
            conditions.push(`t.status = ANY($${paramIndex++})`);
            values.push(statuses);
        }

        // Department filter (multi-select, comma separated)
        if (department) {
            const depts = (department as string).split(',');
            conditions.push(`t.department_label = ANY($${paramIndex++})`);
            values.push(depts);
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
            const today = new Date().toISOString().split('T')[0];
            switch (period) {
                case 'today':
                    conditions.push(`t.due_date = $${paramIndex++}`);
                    values.push(today);
                    break;
                case 'this_week': {
                    const endOfWeek = new Date();
                    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
                    conditions.push(`t.due_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
                    values.push(today, endOfWeek.toISOString().split('T')[0]);
                    paramIndex += 2;
                    break;
                }
                case 'this_month': {
                    const endOfMonth = new Date();
                    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
                    conditions.push(`t.due_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
                    values.push(today, endOfMonth.toISOString().split('T')[0]);
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

        // CSAPATLAPÚ NÉZET: regular 'user' role sees only  tasks they created or are assigned to via subtasks
        if (req.user?.role === 'user') {
            conditions.push(`(
                t.created_by = $${paramIndex} OR
                EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $${paramIndex})
            )`);
            values.push(req.user.id);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

        // Main query with aggregates
        const query = `
      SELECT
        t.*,
        u.display_name AS creator_name,
        u.avatar_url AS creator_avatar,
        au.display_name AS assignee_name,
        au.avatar_url AS assignee_avatar,
        COALESCE(sub.total, 0) AS subtask_total,
        COALESCE(sub.completed, 0) AS subtask_completed,
        al.last_activity,
        CASE WHEN rt.id IS NOT NULL AND rt.is_active = true THEN true ELSE false END AS is_recurring,
        (SELECT tsc.reason FROM task_status_changes tsc
         WHERE tsc.task_id = t.id AND tsc.new_status = 'blocat'
         ORDER BY tsc.created_at DESC LIMIT 1) AS blocked_reason
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      LEFT JOIN users au ON t.assigned_to = au.id
      LEFT JOIN (
        SELECT task_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_completed = true) AS completed
        FROM subtasks WHERE deleted_at IS NULL GROUP BY task_id
      ) sub ON sub.task_id = t.id
      LEFT JOIN (
        SELECT task_id, MAX(created_at) AS last_activity
        FROM activity_log GROUP BY task_id
      ) al ON al.task_id = t.id
      LEFT JOIN recurring_tasks rt ON rt.template_task_id = t.id
      ${whereClause}
      ORDER BY
        CASE WHEN t.status = 'terminat' THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        values.push(parseInt(limit as string), offset);

        const { rows } = await pool.query(query, values);

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) FROM tasks t ${whereClause}`;
        const countValues = values.slice(0, -2); // Remove limit and offset
        const { rows: countRows } = await pool.query(countQuery, countValues);

        res.json({
            tasks: rows,
            total: parseInt(countRows[0].count),
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        });
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: 'Eroare la încărcarea task-urilor.' });
    }
});

// POST /api/tasks — create task
router.post('/', authMiddleware, validateCreateTask, async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, due_date, department_label, assigned_to } = req.body;

        if (!title || !due_date || !department_label) {
            res.status(400).json({ error: 'Titlul, data limită și departamentul sunt obligatorii.' });
            return;
        }

        if (title.length > 500) {
            res.status(400).json({ error: 'Titlul nu poate depăși 500 de caractere.' });
            return;
        }

        const taskId = uuidv4();
        const { rows } = await pool.query(
            `INSERT INTO tasks (id, title, description, due_date, created_by, department_label, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [taskId, title, description || null, due_date, req.user!.id, department_label, assigned_to || null]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'created', $3)`,
            [taskId, req.user!.id, JSON.stringify({ title, department: department_label })]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating task:', err);
        res.status(500).json({ error: 'Eroare la crearea task-ului.' });
    }
});

// GET /api/tasks/:id — task details
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

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

        if (taskRows.length === 0) {
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        // Get subtasks
        const { rows: subtasks } = await pool.query(
            `SELECT s.*, u.display_name AS assigned_to_name, u.avatar_url AS assigned_to_avatar
       FROM subtasks s
       LEFT JOIN users u ON s.assigned_to = u.id
       WHERE s.task_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.order_index`,
            [id]
        );

        // Get recent comments (last 20)
        const { rows: comments } = await pool.query(
            `SELECT c.*, u.display_name AS author_name, u.avatar_url AS author_avatar
       FROM task_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at DESC
       LIMIT 20`,
            [id]
        );

        // Get attachments
        const { rows: attachments } = await pool.query(
            `SELECT a.*, u.display_name AS uploader_name
       FROM task_attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.task_id = $1
       ORDER BY a.created_at DESC`,
            [id]
        );

        // Get activity log (last 50)
        const { rows: activity } = await pool.query(
            `SELECT al.*, u.display_name AS user_name, u.avatar_url AS user_avatar
       FROM activity_log al
       JOIN users u ON al.user_id = u.id
       WHERE al.task_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
            [id]
        );

        // Get alerts
        const { rows: alerts } = await pool.query(
            `SELECT a.*,
               uc.display_name AS creator_name, uc.avatar_url AS creator_avatar,
               ur.display_name AS resolved_by_name
             FROM task_alerts a
             JOIN users uc ON a.created_by = uc.id
             LEFT JOIN users ur ON a.resolved_by = ur.id
             WHERE a.task_id = $1
             ORDER BY a.created_at DESC`,
            [id]
        );

        res.json({
            ...taskRows[0],
            subtasks,
            comments: comments.reverse(), // Oldest first for display
            attachments,
            activity,
            alerts,
        });
    } catch (err) {
        console.error('Error fetching task:', err);
        res.status(500).json({ error: 'Eroare la încărcarea task-ului.' });
    }
});

// PUT /api/tasks/:id — update task
router.put('/:id', authMiddleware, validateUpdateTask, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, department_label, assigned_to } = req.body;

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (title !== undefined) {
            if (title.length > 500) {
                res.status(400).json({ error: 'Titlul nu poate depăși 500 de caractere.' });
                return;
            }
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (department_label !== undefined) {
            // Log label change
            const { rows: oldRows } = await pool.query('SELECT department_label FROM tasks WHERE id = $1', [id]);
            if (oldRows.length > 0 && oldRows[0].department_label !== department_label) {
                await pool.query(
                    `INSERT INTO activity_log (task_id, user_id, action_type, details)
           VALUES ($1, $2, 'label_changed', $3)`,
                    [id, req.user!.id, JSON.stringify({
                        old_label: oldRows[0].department_label,
                        new_label: department_label
                    })]
                );
            }
            updates.push(`department_label = $${paramIndex++}`);
            values.push(department_label);
        }
        if (assigned_to !== undefined) {
            updates.push(`assigned_to = $${paramIndex++}`);
            values.push(assigned_to || null);
        }

        if (updates.length === 0) {
            res.status(400).json({ error: 'Nimic de actualizat.' });
            return;
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ error: 'Eroare la actualizarea task-ului.' });
    }
});

// PUT /api/tasks/:id/status — change status
router.put('/:id/status', authMiddleware, validateChangeStatus, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body as { status: TaskStatus; reason?: string };

        if (!status) {
            res.status(400).json({ error: 'Statusul este obligatoriu.' });
            return;
        }

        // CRITICAL RULE: reason is mandatory for 'blocat'
        if (status === 'blocat' && (!reason || reason.trim() === '')) {
            res.status(400).json({ error: 'Motivul este obligatoriu pentru statusul "Blocat".' });
            return;
        }

        // Get current status
        const { rows: current } = await pool.query('SELECT status FROM tasks WHERE id = $1', [id]);
        if (current.length === 0) {
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        const oldStatus = current[0].status;

        // Update task
        const { rows } = await pool.query(
            `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );

        // Log status change
        await pool.query(
            `INSERT INTO task_status_changes (task_id, old_status, new_status, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
            [id, oldStatus, status, reason || null, req.user!.id]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'status_changed', $3)`,
            [id, req.user!.id, JSON.stringify({ old_status: oldStatus, new_status: status, reason: reason || null })]
        );

        // If status changed to 'terminat', auto-resolve all alerts
        if (status === 'terminat') {
            await pool.query(
                `UPDATE task_alerts SET is_resolved = true, resolved_at = NOW() WHERE task_id = $1 AND is_resolved = false`,
                [id]
            );

            // Also handle recurring tasks
            const { rows: recurringRows } = await pool.query(
                `SELECT * FROM recurring_tasks WHERE template_task_id = $1 AND is_active = true`,
                [id]
            );

            if (recurringRows.length > 0) {
                const recurring = recurringRows[0];
                const task = rows[0];

                // Calculate next due date
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
                }

                // Create new task
                const newTaskId = uuidv4();
                await pool.query(
                    `INSERT INTO tasks (id, title, description, due_date, created_by, department_label)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                    [newTaskId, task.title, task.description, nextDueDate.toISOString().split('T')[0],
                        task.created_by, task.department_label]
                );

                // Copy subtasks as template
                const { rows: oldSubtasks } = await pool.query(
                    `SELECT title, assigned_to, order_index FROM subtasks WHERE task_id = $1 ORDER BY order_index`,
                    [id]
                );

                for (const st of oldSubtasks) {
                    await pool.query(
                        `INSERT INTO subtasks (task_id, title, assigned_to, order_index)
             VALUES ($1, $2, $3, $4)`,
                        [newTaskId, st.title, st.assigned_to, st.order_index]
                    );
                }

                // Update recurring task to point to new task
                await pool.query(
                    `UPDATE recurring_tasks SET template_task_id = $1, next_run_date = $2, updated_at = NOW()
           WHERE id = $3`,
                    [newTaskId, nextDueDate.toISOString().split('T')[0], recurring.id]
                );

                // Activity log for recurring creation
                await pool.query(
                    `INSERT INTO activity_log (task_id, user_id, action_type, details)
           VALUES ($1, $2, 'recurring_created', $3)`,
                    [newTaskId, req.user!.id, JSON.stringify({
                        source_task_id: id,
                        frequency: recurring.frequency,
                        new_due_date: nextDueDate.toISOString().split('T')[0]
                    })]
                );
            }
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error changing status:', err);
        res.status(500).json({ error: 'Eroare la schimbarea statusului.' });
    }
});

// PUT /api/tasks/:id/due-date — change due date (reason mandatory)
router.put('/:id/due-date', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { due_date, reason } = req.body;

        if (!due_date) {
            res.status(400).json({ error: 'Data limită este obligatorie.' });
            return;
        }

        // CRITICAL RULE: reason is always mandatory
        if (!reason || reason.trim() === '') {
            res.status(400).json({ error: 'Motivul reprogramării este obligatoriu.' });
            return;
        }

        // Get current due date
        const { rows: current } = await pool.query('SELECT due_date FROM tasks WHERE id = $1', [id]);
        if (current.length === 0) {
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        const oldDate = current[0].due_date;

        // Update task
        const { rows } = await pool.query(
            `UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [due_date, id]
        );

        // Log due date change
        await pool.query(
            `INSERT INTO task_due_date_changes (task_id, old_date, new_date, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
            [id, oldDate, due_date, reason, req.user!.id]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'due_date_changed', $3)`,
            [id, req.user!.id, JSON.stringify({
                old_date: oldDate,
                new_date: due_date,
                reason
            })]
        );

        // Auto-comment: make the date change reason visible in the Comments tab
        const oldDateStr = new Date(oldDate).toLocaleDateString('ro-RO');
        const newDateStr = new Date(due_date).toLocaleDateString('ro-RO');
        const commentContent = `📅 Data limită schimbată: ${oldDateStr} → ${newDateStr}\n📝 Motiv: ${reason}`;
        await pool.query(
            `INSERT INTO task_comments (task_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4)`,
            [id, req.user!.id, commentContent, []]
        );

        // Activity log for the auto-comment
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'comment_added', $3)`,
            [id, req.user!.id, JSON.stringify({
                comment_preview: commentContent.substring(0, 100),
                mentions: [],
                auto_generated: true
            })]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('Error changing due date:', err);
        res.status(500).json({ error: 'Eroare la schimbarea datei limită.' });
    }
});

// DELETE /api/tasks/:id — delete task (creator or admin only)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query('SELECT created_by FROM tasks WHERE id = $1', [id]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        if (rows[0].created_by !== req.user!.id && req.user!.role !== 'admin') {
            res.status(403).json({ error: 'Doar creatorul sau un admin poate șterge task-ul.' });
            return;
        }

        // Soft delete — set deleted_at instead of hard DELETE
        await pool.query('UPDATE tasks SET deleted_at = NOW() WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).json({ error: 'Eroare la ștergerea task-ului.' });
    }
});

// POST /api/tasks/:id/duplicate — duplicate task with subtasks
router.post('/:id/duplicate', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        // Get original task
        const { rows: [original] } = await pool.query(
            'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL', [id]
        );
        if (!original) { res.status(404).json({ error: 'Task negăsit.' }); return; }

        const newId = uuidv4();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        // Create duplicate task
        await pool.query(
            `INSERT INTO tasks (id, title, description, status, due_date, created_by, department_label)
             VALUES ($1, $2, $3, 'de_rezolvat', $4, $5, $6)`,
            [newId, `${original.title} (copie)`, original.description, dueDate.toISOString().split('T')[0], req.user!.id, original.department_label]
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
            [newId, req.user!.id, JSON.stringify({ duplicated_from: id, original_title: original.title })]
        );

        // Activity log on original task
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details) VALUES ($1, $2, 'created', $3)`,
            [id, req.user!.id, JSON.stringify({ duplicated_to: newId })]
        );

        // Return new task
        const { rows: [newTask] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [newId]);
        res.status(201).json(newTask);
    } catch (err) {
        console.error('Error duplicating task:', err);
        res.status(500).json({ error: 'Eroare la duplicarea task-ului.' });
    }
});

// === SUB-ROUTERS (mounted on /:id) ===
router.use('/:id', taskSubtaskRoutes);
router.use('/:id', taskCommentRoutes);
router.use('/:id', taskAttachmentRoutes);
router.use('/:id', taskActivityRoutes);
router.use('/:id', taskRecurringRoutes);
router.use('/:id', taskAlertRoutes);

export default router;
