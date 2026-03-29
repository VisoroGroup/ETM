import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';

const router = Router({ mergeParams: true });

// DELETE /api/tasks/:id/attachments/:attachmentId
router.delete('/attachments/:attachmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId, attachmentId } = req.params;
        const userRole = req.user?.role;
        const userId = req.user?.id;

        // Task-level access check (uses shared middleware — includes manager role)
        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
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
