import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// DELETE /api/tasks/:id/attachments/:attachmentId
router.delete('/attachments/:attachmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId, attachmentId } = req.params;
        const userRole = req.user?.role;
        const userId = req.user?.id;

        // Task-level access check (admin/superadmin bypass)
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            const { rows: access } = await pool.query(`
                SELECT 1 FROM tasks WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR assigned_to = $2)
                UNION
                SELECT 1 FROM subtasks WHERE task_id = $1 AND assigned_to = $2 AND deleted_at IS NULL
            `, [taskId, userId]);

            if (access.length === 0) {
                res.status(403).json({ error: 'Nincs hozzáférésed ehhez a taskhoz.' });
                return;
            }
        }

        const { rows: existing } = await pool.query(
            'SELECT uploaded_by FROM task_attachments WHERE id = $1', [attachmentId]
        );

        if (existing.length === 0) {
            res.status(404).json({ error: 'Fișierul nu a fost găsit.' });
            return;
        }

        // Non-admin users can only delete their own uploads
        if (existing[0].uploaded_by !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
            res.status(403).json({ error: 'Poți șterge doar fișierele încărcate de tine.' });
            return;
        }

        await pool.query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);

        res.json({ message: 'Fișierul a fost șters.' });
    } catch (err) {
        res.status(500).json({ error: 'Eroare la ștergerea fișierului.' });
    }
});

export default router;
