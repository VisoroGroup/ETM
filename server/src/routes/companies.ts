import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Company } from '../types';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/companies
 * Returns the companies the calling user can access.
 *
 * - superadmin / admin → all non-archived companies
 * - everyone else      → companies listed in user_companies for this user
 *
 * Sorted by sort_order asc, then id.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const ids = req.userCompanyIds ?? [];
        if (ids.length === 0) {
            res.json({ companies: [] });
            return;
        }
        const { rows } = await pool.query<Company>(
            `SELECT id, name, sidebar_name, slug, language, template_type, color, icon,
                    sort_order, is_archived, created_at, updated_at
               FROM companies
              WHERE id = ANY($1::int[]) AND is_archived = false
              ORDER BY sort_order ASC, id ASC`,
            [ids]
        );
        res.json({ companies: rows });
    } catch (err) {
        console.error('GET /companies failed:', err);
        res.status(500).json({ error: 'Eroare la încărcarea companiilor.' });
    }
});

export default router;
