import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { tError } from '../utils/serverErrors';

const router = Router();

router.use(authMiddleware);

// GET /api/settings/company-goal — get the active company's main goal banner
router.get('/company-goal', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const { rows } = await pool.query(
        `SELECT value FROM settings WHERE key = 'company_main_goal' AND company_id = $1`,
        [req.activeCompanyId]
    );
    res.json({ goal: rows[0]?.value || '' });
}));

// PUT /api/settings/company-goal — update the active company's main goal
// (superadmin only). Scoped per company so Hungary's banner doesn't
// overwrite Visoro Global's.
router.put('/company-goal', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const { goal } = req.body;
    if (goal === undefined || goal === null) {
        res.status(400).json({ error: tError(req, 'company_objective_required') });
        return;
    }

    const { rows } = await pool.query(`
        INSERT INTO settings (key, value, updated_by, company_id)
        VALUES ('company_main_goal', $1, $2, $3)
        ON CONFLICT (company_id, key) DO UPDATE
          SET value = $1, updated_by = $2, updated_at = NOW()
        RETURNING *
    `, [goal, req.user!.id, req.activeCompanyId]);

    res.json({ goal: rows[0].value });
}));

// GET /api/settings/holidays — the active company's non-working days as
// 'YYYY-MM-DD' strings. Weekends are implicit; these are the seeded national
// holidays (migration 083) plus any admin-added ones. The frontend uses them
// so a recurring task's displayed "next due" date snaps to the same workday
// the server's rollForwardToWorkday would pick — badge and reality agree.
router.get('/holidays', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const { rows } = await pool.query<{ holiday_date: string }>(
        `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date
           FROM company_holidays
          WHERE company_id = $1
          ORDER BY holiday_date`,
        [req.activeCompanyId]
    );
    res.json({ holidays: rows.map(r => r.holiday_date) });
}));

export default router;
