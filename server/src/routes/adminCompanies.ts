import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { Company, CompanyLanguage, CompanyTemplateType } from '../types';

const router = Router();

// Company management is a superadmin-only area. Admin users (Mia/Emo) can
// READ the list (so they can see what companies exist) but cannot create,
// edit, or archive — those are reserved for Robert.
router.use(authMiddleware);
router.use(requireRole('admin'));

const ALLOWED_LANGUAGES: CompanyLanguage[] = ['ro', 'hu', 'en'];
const ALLOWED_TEMPLATES: CompanyTemplateType[] = ['full', 'project', 'simple'];

function isValidHexColor(s: unknown): s is string {
    return typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s);
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 50);
}

// GET /api/admin/companies — list ALL companies including archived. Both admin
// and superadmin can read this.
router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
    const { rows } = await pool.query<Company>(
        `SELECT id, name, sidebar_name, slug, language, template_type, color, icon,
                sort_order, is_archived, created_at, updated_at
           FROM companies
          ORDER BY sort_order ASC, id ASC`
    );
    res.json({ companies: rows });
}));

// POST /api/admin/companies — create a new company. Superadmin only.
router.post('/', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, sidebar_name, slug, language, template_type, color, icon } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Numele companiei este obligatoriu.' });
        return;
    }
    if (typeof sidebar_name !== 'string' || sidebar_name.trim().length === 0) {
        res.status(400).json({ error: 'Numele pentru sidebar este obligatoriu.' });
        return;
    }
    const lang = ALLOWED_LANGUAGES.includes(language) ? language : 'ro';
    const tpl = ALLOWED_TEMPLATES.includes(template_type) ? template_type : 'simple';
    const col = isValidHexColor(color) ? color : '#3B82F6';
    const ico = typeof icon === 'string' && icon.length > 0 ? icon : null;
    const finalSlug = (typeof slug === 'string' && slug.trim().length > 0)
        ? slugify(slug)
        : slugify(sidebar_name);
    if (finalSlug.length === 0) {
        res.status(400).json({ error: 'Slug invalid (folosește litere și cifre).' });
        return;
    }

    // sort_order: append to the end (max existing + 1)
    const { rows: maxRows } = await pool.query<{ max_order: number | null }>(
        'SELECT MAX(sort_order)::int AS max_order FROM companies'
    );
    const nextOrder = (maxRows[0]?.max_order ?? 0) + 1;

    try {
        const { rows } = await pool.query<Company>(
            `INSERT INTO companies (name, sidebar_name, slug, language, template_type, color, icon, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id, name, sidebar_name, slug, language, template_type, color, icon,
                       sort_order, is_archived, created_at, updated_at`,
            [name.trim(), sidebar_name.trim(), finalSlug, lang, tpl, col, ico, nextOrder]
        );
        res.status(201).json({ company: rows[0] });
    } catch (err: any) {
        if (err?.code === '23505') {
            res.status(409).json({ error: 'Slug-ul este deja folosit. Alege altul.' });
            return;
        }
        throw err;
    }
}));

// PUT /api/admin/companies/:id — update company fields. Superadmin only.
router.put('/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'ID invalid.' });
        return;
    }

    const { name, sidebar_name, slug, language, template_type, color, icon, sort_order } = req.body ?? {};

    const updates: string[] = [];
    const values: any[] = [];

    if (typeof name === 'string' && name.trim().length > 0) {
        values.push(name.trim()); updates.push(`name = $${values.length}`);
    }
    if (typeof sidebar_name === 'string' && sidebar_name.trim().length > 0) {
        values.push(sidebar_name.trim()); updates.push(`sidebar_name = $${values.length}`);
    }
    if (typeof slug === 'string' && slug.trim().length > 0) {
        const s = slugify(slug);
        if (s.length === 0) {
            res.status(400).json({ error: 'Slug invalid.' });
            return;
        }
        values.push(s); updates.push(`slug = $${values.length}`);
    }
    if (ALLOWED_LANGUAGES.includes(language)) {
        values.push(language); updates.push(`language = $${values.length}`);
    }
    if (ALLOWED_TEMPLATES.includes(template_type)) {
        values.push(template_type); updates.push(`template_type = $${values.length}`);
    }
    if (isValidHexColor(color)) {
        values.push(color); updates.push(`color = $${values.length}`);
    }
    if (typeof icon === 'string') {
        values.push(icon.length > 0 ? icon : null); updates.push(`icon = $${values.length}`);
    }
    if (Number.isFinite(sort_order)) {
        values.push(Number(sort_order)); updates.push(`sort_order = $${values.length}`);
    }

    if (updates.length === 0) {
        res.status(400).json({ error: 'Nu s-a trimis niciun câmp pentru actualizare.' });
        return;
    }

    values.push(id);
    try {
        const { rows } = await pool.query<Company>(
            `UPDATE companies
                SET ${updates.join(', ')}, updated_at = NOW()
              WHERE id = $${values.length}
            RETURNING id, name, sidebar_name, slug, language, template_type, color, icon,
                      sort_order, is_archived, created_at, updated_at`,
            values
        );
        if (rows.length === 0) {
            res.status(404).json({ error: 'Companie inexistentă.' });
            return;
        }
        res.json({ company: rows[0] });
    } catch (err: any) {
        if (err?.code === '23505') {
            res.status(409).json({ error: 'Slug-ul este deja folosit.' });
            return;
        }
        throw err;
    }
}));

// PATCH /api/admin/companies/:id/archive — toggle archived flag. Superadmin only.
router.patch('/:id/archive', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'ID invalid.' });
        return;
    }
    const archive = req.body?.archive !== false; // default true
    if (id === 1 && archive) {
        res.status(400).json({ error: 'Visoro Global nu poate fi arhivată.' });
        return;
    }
    const { rows } = await pool.query<Company>(
        `UPDATE companies SET is_archived = $1, updated_at = NOW()
          WHERE id = $2
        RETURNING id, name, sidebar_name, slug, language, template_type, color, icon,
                  sort_order, is_archived, created_at, updated_at`,
        [archive, id]
    );
    if (rows.length === 0) {
        res.status(404).json({ error: 'Companie inexistentă.' });
        return;
    }
    res.json({ company: rows[0] });
}));

export default router;
