import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Public, no-auth router for read-only project status shared via a token.
// Mounted at /api/public/projects so the route bypasses authMiddleware
// entirely (it lives on the global Express app, not under /api/pug/projects).
// Each handler validates the token itself.

const router = Router();

async function loadValidToken(token: string) {
    const { rows } = await pool.query(
        `SELECT t.id, t.project_id, t.company_id, t.expires_at, t.revoked_at
           FROM pug_project_share_tokens t
          WHERE t.token = $1
          LIMIT 1`,
        [token]
    );
    if (rows.length === 0) return null;
    const t = rows[0];
    if (t.revoked_at) return null;
    if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) return null;
    return t;
}

router.get('/projects/:token', asyncHandler(async (req: Request, res: Response) => {
    const t = await loadValidToken(req.params.token);
    if (!t) {
        res.status(404).json({ error: 'Link invalid sau expirat.' });
        return;
    }

    // Record the view (best-effort).
    pool.query(
        `UPDATE pug_project_share_tokens
            SET last_viewed_at = NOW(),
                view_count = view_count + 1
          WHERE id = $1`,
        [t.id]
    ).catch(() => {});

    // Public payload — deliberately minimal. Contract amount + invoicing
    // fields are excluded; clients shouldn't see the firm's bookkeeping.
    // Attachments are also excluded for now (would need a separate token-
    // signed file URL; not worth the surface for the MVP).
    const { rows: pRows } = await pool.query(
        `SELECT p.title, p.client_name, p.location, p.contract_number,
                p.contract_date, p.area_hectares, p.deadline, p.notes,
                p.created_at,
                wt.name AS work_type_name,
                c.name AS company_name, c.color AS company_color
           FROM pug_projects p
           LEFT JOIN pug_work_types wt ON wt.id = p.work_type_id
           JOIN companies c ON c.id = p.company_id
          WHERE p.id = $1 AND p.company_id = $2`,
        [t.project_id, t.company_id]
    );
    if (pRows.length === 0) {
        res.status(404).json({ error: 'Proiectul nu mai există.' });
        return;
    }

    const { rows: stages } = await pool.query(
        `SELECT ps.id, sc.name AS stage_name, sc.icon, sc.color,
                ps.deadline, ps.notes,
                st.name AS status_name, st.color AS status_color, st.is_terminal
           FROM pug_project_stages ps
           JOIN pug_stage_catalog sc ON sc.id = ps.stage_catalog_id
           LEFT JOIN pug_status_catalog st ON st.id = ps.status_id
          WHERE ps.project_id = $1
          ORDER BY ps.sort_order ASC, sc.sort_order ASC`,
        [t.project_id]
    );

    res.json({ project: pRows[0], stages });
}));

export default router;
