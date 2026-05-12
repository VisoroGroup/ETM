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

export default router;
