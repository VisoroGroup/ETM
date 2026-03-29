import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/alerts
router.get('/alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
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
    } catch (err) {
        res.status(500).json({ error: 'Eroare la încărcarea alertelor.' });
    }
});

// POST /api/tasks/:id/alerts
router.post('/alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { content } = req.body;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

        if (!content || content.trim() === '') {
            res.status(400).json({ error: 'Conținutul alertei este obligatoriu.' });
            return;
        }

        const { rows } = await pool.query(
            `INSERT INTO task_alerts (task_id, created_by, content)
             VALUES ($1, $2, $3) RETURNING *`,
            [taskId, req.user!.id, content.trim()]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
             VALUES ($1, $2, 'alert_added', $3)`,
            [taskId, req.user!.id, JSON.stringify({ content: content.substring(0, 100) })]
        );

        rows[0].creator_name = req.user!.display_name;
        rows[0].creator_avatar = req.user!.avatar_url;

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating alert:', err);
        res.status(500).json({ error: 'Eroare la adăugarea alertei.' });
    }
});

// PUT /api/tasks/:id/alerts/:alertId/resolve
router.put('/alerts/:alertId/resolve', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId, alertId } = req.params;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

        const { rows: existing } = await pool.query(
            'SELECT * FROM task_alerts WHERE id = $1', [alertId]
        );
        if (existing.length === 0) {
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
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
             VALUES ($1, $2, 'alert_resolved', $3)`,
            [existing[0].task_id, req.user!.id, JSON.stringify({ alert_content: existing[0].content.substring(0, 100) })]
        );

        rows[0].resolved_by_name = req.user!.display_name;
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la rezolvarea alertei.' });
    }
});

// DELETE /api/tasks/:id/alerts/:alertId
router.delete('/alerts/:alertId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId, alertId } = req.params;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

        const { rows: existing } = await pool.query(
            'SELECT created_by FROM task_alerts WHERE id = $1', [alertId]
        );
        if (existing.length === 0) {
            res.status(404).json({ error: 'Alerta nu a fost găsită.' });
            return;
        }

        if (existing[0].created_by !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
            res.status(403).json({ error: 'Poți șterge doar propriile alerte.' });
            return;
        }

        await pool.query('DELETE FROM task_alerts WHERE id = $1', [alertId]);
        res.json({ message: 'Alerta a fost ștearsă.' });
    } catch (err) {
        res.status(500).json({ error: 'Eroare la ștergerea alertei.' });
    }
});

export default router;
