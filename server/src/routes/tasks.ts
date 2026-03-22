import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus } from '../types';
import { validateCreateTask, validateUpdateTask, validateChangeStatus } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import * as taskService from '../services/taskService';
import taskSubtaskRoutes from './taskSubtasks';
import taskCommentRoutes from './taskComments';
import taskAttachmentRoutes from './taskAttachments';
import taskActivityRoutes from './taskActivity';
import taskRecurringRoutes from './taskRecurring';
import taskAlertRoutes from './taskAlerts';
import taskDependencyRoutes from './taskDependencies';

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

        // TEAM-BASED VIEW: regular 'user' role sees only tasks they created or are assigned to via subtasks
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
         ORDER BY tsc.created_at DESC LIMIT 1) AS blocked_reason,
        COALESCE(deps.dep_count, 0) AS dependency_count,
        COALESCE(blks.blocks_count, 0) AS blocks_count
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
      LEFT JOIN (
        SELECT blocked_task_id, COUNT(*) AS dep_count
        FROM task_dependencies td2
        JOIN tasks bt2 ON td2.blocking_task_id = bt2.id AND bt2.status != 'terminat'
        GROUP BY blocked_task_id
      ) deps ON deps.blocked_task_id = t.id
      LEFT JOIN (
        SELECT blocking_task_id, COUNT(*) AS blocks_count
        FROM task_dependencies
        GROUP BY blocking_task_id
      ) blks ON blks.blocking_task_id = t.id
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
router.post('/', authMiddleware, validateCreateTask, asyncHandler(async (req: AuthRequest, res: Response) => {
    const task = await taskService.createTask(req.body, req.user!.id);
    res.status(201).json(task);
}));

// GET /api/tasks/:id — task details
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
        res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
        return;
    }
    res.json(task);
}));

// PUT /api/tasks/:id — update task
router.put('/:id', authMiddleware, validateUpdateTask, asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await taskService.updateTask(req.params.id, req.body, req.user!.id);
    if (result === null) {
        res.status(400).json({ error: 'Nimic de actualizat.' });
        return;
    }
    if (result === undefined) {
        res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
        return;
    }
    res.json(result);
}));

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
                        if (recurring.workdays_only) {
                            // Skip weekends: advance to next working day
                            do {
                                nextDueDate.setDate(nextDueDate.getDate() + 1);
                            } while (nextDueDate.getDay() === 0 || nextDueDate.getDay() === 6);
                        } else {
                            nextDueDate.setDate(nextDueDate.getDate() + 1);
                        }
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

            // Handle dependency resolution: notify blocked tasks
            const { rows: blockedTasks } = await pool.query(
                `SELECT td.blocked_task_id, t.title, t.assigned_to
                 FROM task_dependencies td
                 JOIN tasks t ON td.blocked_task_id = t.id
                 WHERE td.blocking_task_id = $1 AND t.deleted_at IS NULL`,
                [id]
            );

            const completedTaskTitle = rows[0].title;
            for (const bt of blockedTasks) {
                await pool.query(
                    `INSERT INTO activity_log (task_id, user_id, action_type, details)
                     VALUES ($1, $2, 'dependency_resolved', $3)`,
                    [bt.blocked_task_id, req.user!.id, JSON.stringify({ resolved_by_task: id, resolved_task_title: completedTaskTitle })]
                );
                if (bt.assigned_to) {
                    await pool.query(
                        `INSERT INTO notifications (user_id, task_id, type, message)
                         VALUES ($1, $2, 'dependency_resolved', $3)`,
                        [bt.assigned_to, bt.blocked_task_id,
                         `\u201E${completedTaskTitle}\u201D s-a finalizat \u2014 sarcina ta \u201E${bt.title}\u201D este deblocat\u0103!`]
                    );
                }
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

// DELETE /api/tasks/:id — soft delete task (creator or admin only)
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await taskService.softDeleteTask(req.params.id, req.user!.id, req.user!.role);
    if ('error' in result) {
        if (result.error === 'not_found') {
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }
        res.status(403).json({ error: 'Doar creatorul sau un admin poate șterge task-ul.' });
        return;
    }
    res.status(204).send();
}));

// POST /api/tasks/:id/duplicate — duplicate task with subtasks
router.post('/:id/duplicate', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const newTask = await taskService.duplicateTask(req.params.id, req.user!.id);
    if (!newTask) {
        res.status(404).json({ error: 'Task negăsit.' });
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

export default router;
