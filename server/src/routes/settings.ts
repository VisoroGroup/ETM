import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

// GET /api/settings/company-goal — get the company main goal (displayed on every page)
router.get('/company-goal', asyncHandler(async (_req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
        `SELECT value FROM settings WHERE key = 'company_main_goal'`
    );
    res.json({ goal: rows[0]?.value || '' });
}));

// PUT /api/settings/company-goal — update the company main goal (superadmin only)
router.put('/company-goal', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { goal } = req.body;
    if (goal === undefined || goal === null) {
        res.status(400).json({ error: 'Obiectivul companiei este obligatoriu.' });
        return;
    }

    const { rows } = await pool.query(`
        INSERT INTO settings (key, value, updated_by)
        VALUES ('company_main_goal', $1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()
        RETURNING *
    `, [goal, req.user!.id]);

    res.json({ goal: rows[0].value });
}));

export default router;
