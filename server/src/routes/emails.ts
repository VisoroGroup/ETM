import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { sendTestEmail } from '../services/emailService';

const router = Router();
router.use(authMiddleware);

// GET /api/emails/logs — email log lista (admin only)
router.get('/logs', requireRole('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT el.*, u.display_name, u.email as user_email
            FROM email_logs el
            JOIN users u ON el.user_id = u.id
            ORDER BY el.sent_at DESC
            LIMIT 200
        `);
        res.json(rows);
    } catch (err) {
        console.error('Email logs error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea log-urilor.' });
    }
});

// GET /api/emails/logs/my — saját email log
router.get('/logs/my', async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT * FROM email_logs
            WHERE user_id = $1
            ORDER BY sent_at DESC
            LIMIT 50
        `, [req.user!.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare.' });
    }
});

// POST /api/emails/test — teszt email küldés (admin only)
router.post('/test', requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { to, name } = req.body;

        const targetEmail = to || req.user!.email;
        const targetName = name || req.user!.display_name;

        if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
            res.status(400).json({
                error: 'Azure credentials neasetate. Adaugă AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET și GRAPH_SENDER_EMAIL în Railway Variables.'
            });
            return;
        }

        await sendTestEmail(targetEmail, targetName);

        // Log it
        await pool.query(
            `INSERT INTO email_logs (user_id, task_ids, email_type, status)
             VALUES ($1, $2, 'daily_summary', 'sent')`,
            [req.user!.id, []]
        );

        res.json({ success: true, message: `Email de test trimis la ${targetEmail}` });
    } catch (err: any) {
        console.error('Test email error:', err);

        // Log failure
        await pool.query(
            `INSERT INTO email_logs (user_id, task_ids, email_type, status, error_message)
             VALUES ($1, $2, 'daily_summary', 'failed', $3)`,
            [req.user!.id, [], err.message || 'Unknown error']
        ).catch(() => {});

        res.status(500).json({
            error: 'Email küldési hiba: ' + (err.message || 'Ismeretlen hiba'),
            details: err.code || null
        });
    }
});

export default router;
