import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Public, no-auth router for read-only project status shared via a token.
// Mounted at /api/public/projects so the route bypasses authMiddleware
// entirely (it lives on the global Express app, not under /api/pug/projects).
// Each handler validates the token itself.

const router = Router();

// Localized strings keyed by company language. We don't have a server-side
// i18n framework — this page is one of the rare public endpoints, so a small
// inline dictionary is simpler than wiring up a full server translator.
const ERR_MESSAGES = {
    ro: {
        link_invalid: 'Link invalid sau expirat.',
        project_not_found: 'Proiectul nu mai există.',
    },
    hu: {
        link_invalid: 'Érvénytelen vagy lejárt link.',
        project_not_found: 'A projekt már nem létezik.',
    },
    en: {
        link_invalid: 'Link is invalid or has expired.',
        project_not_found: 'Project no longer exists.',
    },
} as const;

type Lang = keyof typeof ERR_MESSAGES;
const toLang = (v: unknown): Lang => (v === 'hu' || v === 'en' ? v : 'ro');

async function loadValidToken(token: string) {
    const { rows } = await pool.query(
        `SELECT t.id, t.project_id, t.company_id, t.expires_at, t.revoked_at,
                c.language AS company_language
           FROM pug_project_share_tokens t
           JOIN companies c ON c.id = t.company_id
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
        // No token → no language context. Default to RO (legacy behavior).
        res.status(404).json({ error: ERR_MESSAGES.ro.link_invalid });
        return;
    }
    const lang = toLang(t.company_language);

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
        res.status(404).json({ error: ERR_MESSAGES[lang].project_not_found });
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

    res.json({ project: pRows[0], stages, language: lang });
}));

export default router;
