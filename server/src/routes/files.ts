import { Router, Response, Request } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/files/avatar/:userId
 * Serve avatar image from PostgreSQL. Public endpoint (no auth)
 * because <img> tags don't send Authorization headers.
 */
router.get('/avatar/:userId', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            'SELECT avatar_data, avatar_mime FROM users WHERE id = $1',
            [req.params.userId]
        );

        if (rows.length === 0 || !rows[0].avatar_data) {
            res.status(404).send('Not found');
            return;
        }

        const { avatar_data, avatar_mime } = rows[0];
        res.set('Content-Type', avatar_mime || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // 24h cache
        res.send(avatar_data);
    } catch (err) {
        console.error('Error serving avatar:', err);
        res.status(500).send('Error');
    }
});

/**
 * GET /api/files/attachment/:attachmentId
 * Serve task attachment from PostgreSQL. Requires authentication.
 * Admins/superadmins can access all; others must be task creator, assignee, or subtask assignee.
 */
router.get('/attachment/:attachmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(
            'SELECT file_data, file_mime, file_name, task_id FROM task_attachments WHERE id = $1',
            [req.params.attachmentId]
        );

        if (rows.length === 0 || !rows[0].file_data) {
            res.status(404).send('Not found');
            return;
        }

        const { file_data, file_mime, file_name, task_id } = rows[0];
        const userRole = req.user?.role;
        const userId = req.user?.id;

        // Admin/superadmin can access all attachments
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            // Check if user is task creator, assignee, or subtask assignee
            const { rows: access } = await pool.query(`
                SELECT 1 FROM tasks WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR assigned_to = $2)
                UNION
                SELECT 1 FROM subtasks WHERE task_id = $1 AND assigned_to = $2 AND deleted_at IS NULL
            `, [task_id, userId]);

            if (access.length === 0) {
                res.status(403).json({ error: 'Nincs hozzáférésed ehhez a fájlhoz.' });
                return;
            }
        }

        res.set('Content-Type', file_mime || 'application/octet-stream');
        res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file_name)}"`);
        // no-store: sensitive attachments (contracts, PDFs) must not be cached
        // by the browser after the user logs out
        res.set('Cache-Control', 'no-store');
        res.send(file_data);
    } catch (err) {
        console.error('Error serving attachment:', err);
        res.status(500).send('Error');
    }
});

export default router;
