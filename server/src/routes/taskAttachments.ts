import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';

const router = Router({ mergeParams: true });

// DELETE /api/tasks/:id/attachments/:attachmentId
router.delete('/attachments/:attachmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { attachmentId } = req.params;

        const { rows: existing } = await pool.query(
            'SELECT uploaded_by, file_url FROM task_attachments WHERE id = $1', [attachmentId]
        );

        if (existing.length === 0) {
            res.status(404).json({ error: 'Fișierul nu a fost găsit.' });
            return;
        }

        if (existing[0].uploaded_by !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
            res.status(403).json({ error: 'Poți șterge doar fișierele încărcate de tine.' });
            return;
        }

        await pool.query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);

        // Delete physical file from disk (non-blocking, best-effort)
        try {
            const uploadDir = process.env.UPLOAD_DIR || 'uploads';
            const filePath = path.join(__dirname, '../..', uploadDir, path.basename(existing[0].file_url));
            await fs.unlink(filePath);
        } catch (fileErr) {
            console.warn(`File cleanup failed: ${existing[0].file_url}`, (fileErr as Error).message);
        }

        res.json({ message: 'Fișierul a fost șters.' });
    } catch (err) {
        res.status(500).json({ error: 'Eroare la ștergerea fișierului.' });
    }
});

export default router;
