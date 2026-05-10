import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// Helper: confirm an alert belongs to :taskId AND active tenant.
async function getAlertInTenant(alertId: string, taskId: string, companyId: number) {
    const { rows } = await pool.query(
        `SELECT a.* FROM task_alerts a
         JOIN tasks t ON t.id = a.task_id
         WHERE a.id = $1 AND a.task_id = $2 AND t.company_id = $3`,
        [alertId, taskId, companyId]
    );
    return rows[0] || null;
}

// GET /api/tasks/:id/alerts
router.get('/alerts', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
        res.status(403).json({ error: 'Nu ai permisiunea pentru această sarcină.' });
        return;
    }
    const { rows } = await pool.query(
        `SELECT a.*,
           uc.display_name AS creator_name, uc.avatar_url AS creator_avatar,
           ur.display_name AS resolved_by_name
         FROM task_alerts a
         JOIN users uc ON a.created_by = uc.id
         LEFT JOIN users ur ON a.resolved_by = ur.id
         WHERE a.task_id = $1
         ORDER BY a.is_resolved ASC, a.created_at DESC`,
        [taskId]
    );
    res.json(rows);
}));

// POST /api/tasks/:id/alerts
router.post('/alerts', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;
    const { content } = req.body;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: 'Nu ai permisiunea pentru această sarcină.' });
        return;
    }

    if (!content || content.trim() === '') {
        res.status(400).json({ error: 'Conținutul alertei este obligatoriu.' });
        return;
    }

    const { rows } = await pool.query(
        `INSERT INTO task_alerts (task_id, created_by, content, company_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [taskId, req.user!.id, content.trim(), companyId]
    );

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
         VALUES ($1, $2, 'alert_added', $3, $4)`,
        [taskId, req.user!.id, JSON.stringify({ content: content.substring(0, 100) }), companyId]
    );

    rows[0].creator_name = req.user!.display_name;
    rows[0].creator_avatar = req.user!.avatar_url;

    res.status(201).json(rows[0]);
}));

// PUT /api/tasks/:id/alerts/:alertId/resolve
router.put('/alerts/:alertId/resolve', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, alertId } = req.params;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: 'Nu ai permisiunea pentru această sarcină.' });
        return;
    }
    if (companyId === undefined) {
        res.status(400).json({ error: 'Companie activă lipsește.' });
        return;
    }

    // Tenant + parent guard
    const existing = await getAlertInTenant(alertId, taskId, companyId);
    if (!existing) {
        res.status(404).json({ error: 'Alerta nu a fost găsită.' });
        return;
    }

    const { rows } = await pool.query(
        `UPDATE task_alerts
         SET is_resolved = true, resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [req.user!.id, alertId]
    );

    // Activity log
    await pool.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
         VALUES ($1, $2, 'alert_resolved', $3, $4)`,
        [existing.task_id, req.user!.id, JSON.stringify({ alert_content: existing.content.substring(0, 100) }), companyId]
    );

    rows[0].resolved_by_name = req.user!.display_name;
    res.json(rows[0]);
}));

// DELETE /api/tasks/:id/alerts/:alertId
router.delete('/alerts/:alertId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, alertId } = req.params;
    const companyId = req.activeCompanyId;

    if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, companyId)) {
        res.status(403).json({ error: 'Nu ai permisiunea pentru această sarcină.' });
        return;
    }
    if (companyId === undefined) {
        res.status(400).json({ error: 'Companie activă lipsește.' });
        return;
    }

    // Tenant + parent guard
    const existing = await getAlertInTenant(alertId, taskId, companyId);
    if (!existing) {
        res.status(404).json({ error: 'Alerta nu a fost găsită.' });
        return;
    }

    if (existing.created_by !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
        res.status(403).json({ error: 'Poți șterge doar propriile alerte.' });
        return;
    }

    await pool.query('DELETE FROM task_alerts WHERE id = $1', [alertId]);
    res.json({ message: 'Alerta a fost ștearsă.' });
}));

export default router;
