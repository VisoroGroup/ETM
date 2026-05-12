import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { tError } from '../utils/serverErrors';

const router = Router();
router.use(authMiddleware);

// Resolve the list of company IDs the user can see notifications for.
// Admins/superadmins typically have access to multiple companies; the bell
// renders cross-company notifications with per-company tinted backgrounds
// (Q34) and switches the active company on click. Regular users have a
// single-element array (their active company), so behavior is unchanged.
function accessibleCompanyIds(req: AuthRequest): number[] {
    const ids = Array.isArray(req.userCompanyIds) ? req.userCompanyIds : [];
    if (ids.length > 0) return ids;
    if (req.activeCompanyId !== undefined) return [req.activeCompanyId];
    return [];
}

// GET /api/notifications — get notifications for current user across every
// company the user has access to (so admins see all, regular users see one).
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyIds = accessibleCompanyIds(req);
    if (companyIds.length === 0) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    try {
        const { rows } = await pool.query(`
            SELECT n.*, n.company_id, u.display_name as created_by_name, u.avatar_url as created_by_avatar,
                   t.title as task_title
            FROM notifications n
            LEFT JOIN users u ON n.created_by = u.id
            LEFT JOIN tasks t ON n.task_id = t.id
            WHERE n.user_id = $1 AND n.company_id = ANY($2::int[])
            ORDER BY n.created_at DESC
            LIMIT 50
        `, [req.user!.id, companyIds]);
        res.json(rows);
    } catch (err) {
        console.error('Notifications error:', err);
        res.status(500).json({ error: tError(req, 'notifications_load_error') });
    }
}));

// GET /api/notifications/unread-count — total unread across accessible companies.
router.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyIds = accessibleCompanyIds(req);
    if (companyIds.length === 0) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    try {
        const { rows: [{ count }] } = await pool.query(
            `SELECT COUNT(*) FROM notifications
             WHERE user_id = $1 AND is_read = false AND company_id = ANY($2::int[])`,
            [req.user!.id, companyIds]
        );
        res.json({ count: parseInt(count, 10) });
    } catch (err) {
        res.status(500).json({ error: tError(req, 'internal_error') });
    }
}));

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyIds = accessibleCompanyIds(req);
    if (companyIds.length === 0) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true
             WHERE id = $1 AND user_id = $2 AND company_id = ANY($3::int[])`,
            [req.params.id, req.user!.id, companyIds]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: tError(req, 'internal_error') });
    }
}));

// PATCH /api/notifications/read-all — mark all as read across accessible companies
router.patch('/read-all', asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyIds = accessibleCompanyIds(req);
    if (companyIds.length === 0) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true
             WHERE user_id = $1 AND is_read = false AND company_id = ANY($2::int[])`,
            [req.user!.id, companyIds]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: tError(req, 'internal_error') });
    }
}));

// PATCH /api/notifications/read-for-task/:taskId
// Body: { types: string[] } — only notifications whose `type` is in the list
// are marked read. Used when a user opens a task drawer / switches to a tab:
// that action proves they saw the corresponding notification type.
router.patch('/read-for-task/:taskId', asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyIds = accessibleCompanyIds(req);
    if (companyIds.length === 0) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const { taskId } = req.params;
    const types = Array.isArray(req.body?.types) ? req.body.types : [];

    if (types.length === 0) {
        res.status(400).json({ error: tError(req, 'types_array_required') });
        return;
    }

    try {
        const { rowCount } = await pool.query(
            `UPDATE notifications
                SET is_read = true
              WHERE user_id = $1
                AND task_id = $2
                AND type = ANY($3::text[])
                AND is_read = false
                AND company_id = ANY($4::int[])`,
            [req.user!.id, taskId, types, companyIds]
        );
        res.json({ success: true, updated: rowCount ?? 0 });
    } catch (err) {
        console.error('read-for-task error:', err);
        res.status(500).json({ error: tError(req, 'internal_error') });
    }
}));

export default router;
