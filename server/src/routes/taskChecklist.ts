import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { asyncHandler } from '../middleware/errorHandler';
import { getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail, escapeHtml } from '../services/notificationEmailService';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/checklist
router.get('/checklist', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id;
    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
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

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
        return;
    }

    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'Titlul este obligatoriu.' });
        return;
    }
    if (title.length > 500) {
        res.status(400).json({ error: 'Titlul nu poate depăși 500 de caractere.' });
        return;
    }

    // Verify task exists and is not deleted
    const { rows: taskCheck } = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL',
        [taskId]
    );
    if (taskCheck.length === 0) {
        res.status(404).json({ error: 'A task nem létezik vagy törölve lett.' });
        return;
    }

    // Auto order_index
    const { rows: [{ next_idx }] } = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM task_checklist_items WHERE task_id = $1`,
        [taskId]
    );

    const { rows: [item] } = await pool.query(
        `INSERT INTO task_checklist_items (task_id, title, order_index, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [taskId, title.trim(), next_idx, req.user!.id]
    );

    // Activity log (non-blocking — don't let enum errors block the actual add)
    try {
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
             VALUES ($1, $2, 'checklist_updated', $3)`,
            [taskId, req.user!.id, JSON.stringify({ action: 'item_added', title: title.trim() })]
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

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
        return;
    }

    // Get old value for completion detection
    const { rows: oldRows } = await pool.query(
        'SELECT is_checked, title FROM task_checklist_items WHERE id = $1 AND task_id = $2',
        [itemId, taskId]
    );
    if (oldRows.length === 0) {
        res.status(404).json({ error: 'Elementul nu a fost găsit.' });
        return;
    }
    const oldItem = oldRows[0];

    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (is_checked !== undefined) { sets.push(`is_checked = $${idx++}`); vals.push(is_checked); }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) { // only updated_at
        res.status(400).json({ error: 'Nimic de actualizat.' });
        return;
    }

    vals.push(itemId, taskId);
    const { rows } = await pool.query(
        `UPDATE task_checklist_items SET ${sets.join(', ')} WHERE id = $${idx++} AND task_id = $${idx} RETURNING *`,
        vals
    );

    if (rows.length === 0) {
        res.status(404).json({ error: 'Elementul nu a fost găsit.' });
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
                    const htmlBody = buildNotificationHtml({
                        recipientName: user.display_name,
                        subtitle: 'Element checklist finalizat',
                        bodyLines: [
                            `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> a bifat un element din checklist:</p>`,
                            `<p style="color: #065f46; font-size: 14px; font-weight: bold; margin: 8px 0;">☑️ ${escapeHtml(itemTitle)}</p>`,
                        ],
                        taskId,
                        taskTitle: task.title,
                    });
                    sendNotificationEmail({
                        userId: user.id, userEmail: user.email, userName: user.display_name,
                        taskId, subject: `[ETM] Checklist bifat — ${itemTitle}`,
                        htmlBody, emailType: 'checklist_checked',
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

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
        return;
    }

    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
        res.status(400).json({ error: 'Lista de ordine este obligatorie.' });
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

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
        res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
        return;
    }

    const { rows } = await pool.query(
        `DELETE FROM task_checklist_items WHERE id = $1 AND task_id = $2 RETURNING *`,
        [itemId, taskId]
    );

    if (rows.length === 0) {
        res.status(404).json({ error: 'Elementul nu a fost găsit.' });
        return;
    }

    res.json({ message: 'Element șters.' });
}));

export default router;
