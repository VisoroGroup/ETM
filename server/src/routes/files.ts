import { Router, Response, Request } from 'express';
import pool from '../config/database';

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
 * Serve task attachment from PostgreSQL. Requires auth via query token or cookie.
 */
router.get('/attachment/:attachmentId', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            'SELECT file_data, file_mime, file_name FROM task_attachments WHERE id = $1',
            [req.params.attachmentId]
        );

        if (rows.length === 0 || !rows[0].file_data) {
            res.status(404).send('Not found');
            return;
        }

        const { file_data, file_mime, file_name } = rows[0];
        res.set('Content-Type', file_mime || 'application/octet-stream');
        res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file_name)}"`);
        res.set('Cache-Control', 'private, max-age=3600');
        res.send(file_data);
    } catch (err) {
        console.error('Error serving attachment:', err);
        res.status(500).send('Error');
    }
});

export default router;
