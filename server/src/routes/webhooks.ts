import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { testWebhook } from '../services/webhookService';
import { z } from 'zod';

const router = Router();

// --- Middleware: admin-only ---
const adminOnly = (req: AuthRequest, res: Response, next: any) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Doar administratorii pot gestiona webhook-urile' });
        return;
    }
    next();
};

// --- Zod validation ---
const VALID_EVENTS = [
    'task.created', 'task.completed', 'task.status_changed', 'task.assigned', 'task.overdue',
    'payment.due_soon', 'payment.overdue', 'payment.paid'
] as const;

const createWebhookSchema = z.object({
    url: z.string().url('URL invalid').max(2048),
    event_type: z.enum(VALID_EVENTS),
    secret: z.string().max(500).optional(),
    description: z.string().max(500).optional()
});

const updateWebhookSchema = z.object({
    url: z.string().url('URL invalid').max(2048).optional(),
    event_type: z.enum(VALID_EVENTS).optional(),
    secret: z.string().max(500).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
    is_active: z.boolean().optional()
});

// IMPORTANT: /deliveries BEFORE /:id to avoid Express treating "deliveries" as :id

// GET /api/webhooks/deliveries — delivery log (admin only)
router.get('/deliveries', authMiddleware, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { event_type, status, subscription_id, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (event_type) { conditions.push(`wd.event_type = $${idx++}`); values.push(event_type); }
    if (status) { conditions.push(`wd.status = $${idx++}`); values.push(status); }
    if (subscription_id) { conditions.push(`wd.subscription_id = $${idx++}`); values.push(subscription_id); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(Math.min(parseInt(limit as string) || 50, 100));
    values.push(parseInt(offset as string) || 0);

    const { rows } = await pool.query(`
        SELECT wd.*, ws.url, ws.description as subscription_description
        FROM webhook_deliveries wd
        JOIN webhook_subscriptions ws ON ws.id = wd.subscription_id
        ${where}
        ORDER BY wd.created_at DESC
        LIMIT $${idx++} OFFSET $${idx}
    `, values);

    res.json(rows);
}));

// GET /api/webhooks — list (admin only)
router.get('/', authMiddleware, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(`
        SELECT ws.*,
               u.display_name as creator_name,
               (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.subscription_id = ws.id AND wd.status = 'delivered') as success_count,
               (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.subscription_id = ws.id AND wd.status = 'failed') as fail_count,
               (SELECT MAX(wd.delivered_at) FROM webhook_deliveries wd WHERE wd.subscription_id = ws.id AND wd.status = 'delivered') as last_success
        FROM webhook_subscriptions ws
        JOIN users u ON u.id = ws.created_by
        ORDER BY ws.created_at DESC
    `);
    res.json(rows);
}));

// POST /api/webhooks — create subscription (admin only)
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = createWebhookSchema.parse(req.body);
    const { rows } = await pool.query(`
        INSERT INTO webhook_subscriptions (url, event_type, secret, description, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [parsed.url, parsed.event_type, parsed.secret || null, parsed.description || null, req.user!.id]);
    res.status(201).json(rows[0]);
}));

// PUT /api/webhooks/:id — update (admin only)
router.put('/:id', authMiddleware, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = updateWebhookSchema.parse(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.url !== undefined) { fields.push(`url = $${idx++}`); values.push(parsed.url); }
    if (parsed.event_type !== undefined) { fields.push(`event_type = $${idx++}`); values.push(parsed.event_type); }
    if (parsed.secret !== undefined) { fields.push(`secret = $${idx++}`); values.push(parsed.secret); }
    if (parsed.description !== undefined) { fields.push(`description = $${idx++}`); values.push(parsed.description); }
    if (parsed.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(parsed.is_active); }

    if (fields.length === 0) {
        res.status(400).json({ error: 'Niciun câmp de actualizat' });
        return;
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const { rows } = await pool.query(
        `UPDATE webhook_subscriptions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
    );

    if (rows.length === 0) {
        res.status(404).json({ error: 'Webhook nu a fost găsit' });
        return;
    }
    res.json(rows[0]);
}));

// DELETE /api/webhooks/:id — delete (admin only)
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rowCount } = await pool.query(
        `DELETE FROM webhook_subscriptions WHERE id = $1`, [req.params.id]
    );
    if (rowCount === 0) {
        res.status(404).json({ error: 'Webhook nu a fost găsit' });
        return;
    }
    res.json({ message: 'Webhook șters cu succes' });
}));

// POST /api/webhooks/:id/test — test send (admin only)
router.post('/:id/test', authMiddleware, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await testWebhook(req.params.id);
    res.json(result);
}));

export default router;
