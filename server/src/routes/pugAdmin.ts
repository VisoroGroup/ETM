import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Admin endpoints for the Visoro Neo Plan PUG module.
 *
 * Scopes everything to req.activeCompanyId — Robert manages the catalogs of
 * the company he's currently looking at. Admin role is sufficient to read;
 * superadmin is required for write operations on the catalogs (matches the
 * "company admin" pattern used elsewhere).
 */
const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const;
type FieldType = typeof FIELD_TYPES[number];

function ensureCompany(req: AuthRequest, res: Response): number | null {
    const id = req.activeCompanyId;
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'Companie activă lipsește.' });
        return null;
    }
    return id as number;
}

// ---------------------------------------------------------------------------
// Stage catalog
// ---------------------------------------------------------------------------
router.get('/stages', asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { rows } = await pool.query(
        `SELECT id, name, icon, color, sort_order, is_default, is_active, created_at, updated_at
           FROM pug_stage_catalog
          WHERE company_id = $1
          ORDER BY sort_order ASC, name ASC`,
        [cid]
    );
    res.json({ stages: rows });
}));

router.post('/stages', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { name, icon, color, is_default, sort_order } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Numele etapei este obligatoriu.' });
        return;
    }
    const { rows: maxRows } = await pool.query<{ m: number | null }>(
        'SELECT MAX(sort_order)::int AS m FROM pug_stage_catalog WHERE company_id = $1', [cid]
    );
    const nextOrder = Number.isFinite(sort_order) ? Number(sort_order) : (maxRows[0]?.m ?? 0) + 1;
    const { rows } = await pool.query(
        `INSERT INTO pug_stage_catalog (company_id, name, icon, color, sort_order, is_default)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, name, icon, color, sort_order, is_default, is_active, created_at, updated_at`,
        [cid, name.trim(), icon ?? null, color ?? '#3B82F6', nextOrder, !!is_default]
    );
    res.status(201).json({ stage: rows[0] });
}));

router.put('/stages/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const { name, icon, color, sort_order, is_default, is_active } = req.body ?? {};
    const sets: string[] = []; const vals: any[] = [];
    if (typeof name === 'string' && name.trim()) { vals.push(name.trim()); sets.push(`name=$${vals.length}`); }
    if (icon !== undefined) { vals.push(icon || null); sets.push(`icon=$${vals.length}`); }
    if (typeof color === 'string') { vals.push(color); sets.push(`color=$${vals.length}`); }
    if (Number.isFinite(sort_order)) { vals.push(Number(sort_order)); sets.push(`sort_order=$${vals.length}`); }
    if (typeof is_default === 'boolean') { vals.push(is_default); sets.push(`is_default=$${vals.length}`); }
    if (typeof is_active === 'boolean') { vals.push(is_active); sets.push(`is_active=$${vals.length}`); }
    if (sets.length === 0) { res.status(400).json({ error: 'Nu s-a trimis nimic.' }); return; }
    vals.push(id, cid);
    const { rows } = await pool.query(
        `UPDATE pug_stage_catalog SET ${sets.join(', ')}, updated_at=NOW()
          WHERE id=$${vals.length - 1} AND company_id=$${vals.length}
        RETURNING id, name, icon, color, sort_order, is_default, is_active, created_at, updated_at`,
        vals
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Etapă inexistentă.' }); return; }
    res.json({ stage: rows[0] });
}));

router.delete('/stages/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    // Prevent delete if any project has this stage attached.
    const { rowCount } = await pool.query(
        'SELECT 1 FROM pug_project_stages WHERE stage_catalog_id = $1 LIMIT 1', [id]
    );
    if (rowCount && rowCount > 0) {
        res.status(409).json({ error: 'Etapa este folosită într-un proiect. Dezactiveaz-o în loc.' });
        return;
    }
    const result = await pool.query('DELETE FROM pug_stage_catalog WHERE id=$1 AND company_id=$2', [id, cid]);
    if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Etapă inexistentă.' }); return; }
    res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Status catalog
// ---------------------------------------------------------------------------
router.get('/statuses', asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { rows } = await pool.query(
        `SELECT id, name, color, sort_order, is_initial, is_terminal, is_active, created_at, updated_at
           FROM pug_status_catalog
          WHERE company_id = $1
          ORDER BY sort_order ASC, name ASC`,
        [cid]
    );
    res.json({ statuses: rows });
}));

router.post('/statuses', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { name, color, is_initial, is_terminal, sort_order } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Numele statusului este obligatoriu.' });
        return;
    }
    const { rows: maxRows } = await pool.query<{ m: number | null }>(
        'SELECT MAX(sort_order)::int AS m FROM pug_status_catalog WHERE company_id = $1', [cid]
    );
    const nextOrder = Number.isFinite(sort_order) ? Number(sort_order) : (maxRows[0]?.m ?? 0) + 1;
    const { rows } = await pool.query(
        `INSERT INTO pug_status_catalog (company_id, name, color, sort_order, is_initial, is_terminal)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, name, color, sort_order, is_initial, is_terminal, is_active, created_at, updated_at`,
        [cid, name.trim(), color ?? '#6B7280', nextOrder, !!is_initial, !!is_terminal]
    );
    res.status(201).json({ status: rows[0] });
}));

router.put('/statuses/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const { name, color, sort_order, is_initial, is_terminal, is_active } = req.body ?? {};
    const sets: string[] = []; const vals: any[] = [];
    if (typeof name === 'string' && name.trim()) { vals.push(name.trim()); sets.push(`name=$${vals.length}`); }
    if (typeof color === 'string') { vals.push(color); sets.push(`color=$${vals.length}`); }
    if (Number.isFinite(sort_order)) { vals.push(Number(sort_order)); sets.push(`sort_order=$${vals.length}`); }
    if (typeof is_initial === 'boolean') { vals.push(is_initial); sets.push(`is_initial=$${vals.length}`); }
    if (typeof is_terminal === 'boolean') { vals.push(is_terminal); sets.push(`is_terminal=$${vals.length}`); }
    if (typeof is_active === 'boolean') { vals.push(is_active); sets.push(`is_active=$${vals.length}`); }
    if (sets.length === 0) { res.status(400).json({ error: 'Nu s-a trimis nimic.' }); return; }
    vals.push(id, cid);
    const { rows } = await pool.query(
        `UPDATE pug_status_catalog SET ${sets.join(', ')}, updated_at=NOW()
          WHERE id=$${vals.length - 1} AND company_id=$${vals.length}
        RETURNING id, name, color, sort_order, is_initial, is_terminal, is_active, created_at, updated_at`,
        vals
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Status inexistent.' }); return; }
    res.json({ status: rows[0] });
}));

router.delete('/statuses/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pug_status_catalog WHERE id=$1 AND company_id=$2', [id, cid]);
    if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Status inexistent.' }); return; }
    res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Work types (PUG / PUZ / etc)
// ---------------------------------------------------------------------------
router.get('/work-types', asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { rows } = await pool.query(
        `SELECT id, name, sort_order, is_active, created_at
           FROM pug_work_types
          WHERE company_id = $1
          ORDER BY sort_order ASC, name ASC`,
        [cid]
    );
    res.json({ work_types: rows });
}));

router.post('/work-types', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { name, sort_order } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Numele tipului este obligatoriu.' });
        return;
    }
    const { rows: maxRows } = await pool.query<{ m: number | null }>(
        'SELECT MAX(sort_order)::int AS m FROM pug_work_types WHERE company_id = $1', [cid]
    );
    const nextOrder = Number.isFinite(sort_order) ? Number(sort_order) : (maxRows[0]?.m ?? 0) + 1;
    const { rows } = await pool.query(
        `INSERT INTO pug_work_types (company_id, name, sort_order) VALUES ($1,$2,$3)
         RETURNING id, name, sort_order, is_active, created_at`,
        [cid, name.trim(), nextOrder]
    );
    res.status(201).json({ work_type: rows[0] });
}));

router.put('/work-types/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const { name, sort_order, is_active } = req.body ?? {};
    const sets: string[] = []; const vals: any[] = [];
    if (typeof name === 'string' && name.trim()) { vals.push(name.trim()); sets.push(`name=$${vals.length}`); }
    if (Number.isFinite(sort_order)) { vals.push(Number(sort_order)); sets.push(`sort_order=$${vals.length}`); }
    if (typeof is_active === 'boolean') { vals.push(is_active); sets.push(`is_active=$${vals.length}`); }
    if (sets.length === 0) { res.status(400).json({ error: 'Nu s-a trimis nimic.' }); return; }
    vals.push(id, cid);
    const { rows } = await pool.query(
        `UPDATE pug_work_types SET ${sets.join(', ')}
          WHERE id=$${vals.length - 1} AND company_id=$${vals.length}
        RETURNING id, name, sort_order, is_active, created_at`,
        vals
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Tip inexistent.' }); return; }
    res.json({ work_type: rows[0] });
}));

router.delete('/work-types/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pug_work_types WHERE id=$1 AND company_id=$2', [id, cid]);
    if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Tip inexistent.' }); return; }
    res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------
router.get('/custom-fields', asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { rows } = await pool.query(
        `SELECT id, name, field_type, options, is_required, sort_order, is_active, created_at, updated_at
           FROM pug_custom_fields
          WHERE company_id = $1
          ORDER BY sort_order ASC, name ASC`,
        [cid]
    );
    res.json({ fields: rows });
}));

router.post('/custom-fields', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { name, field_type, options, is_required, sort_order } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Numele câmpului este obligatoriu.' });
        return;
    }
    if (!FIELD_TYPES.includes(field_type as FieldType)) {
        res.status(400).json({ error: `Tip invalid. Permise: ${FIELD_TYPES.join(', ')}` });
        return;
    }
    if (field_type === 'select' && (!Array.isArray(options) || options.length === 0)) {
        res.status(400).json({ error: 'Câmpurile de tip select au nevoie de opțiuni.' });
        return;
    }
    const { rows: maxRows } = await pool.query<{ m: number | null }>(
        'SELECT MAX(sort_order)::int AS m FROM pug_custom_fields WHERE company_id = $1', [cid]
    );
    const nextOrder = Number.isFinite(sort_order) ? Number(sort_order) : (maxRows[0]?.m ?? 0) + 1;
    const { rows } = await pool.query(
        `INSERT INTO pug_custom_fields (company_id, name, field_type, options, is_required, sort_order)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6)
         RETURNING id, name, field_type, options, is_required, sort_order, is_active, created_at, updated_at`,
        [cid, name.trim(), field_type, options ? JSON.stringify(options) : null, !!is_required, nextOrder]
    );
    res.status(201).json({ field: rows[0] });
}));

router.put('/custom-fields/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const { name, field_type, options, is_required, sort_order, is_active } = req.body ?? {};
    const sets: string[] = []; const vals: any[] = [];
    if (typeof name === 'string' && name.trim()) { vals.push(name.trim()); sets.push(`name=$${vals.length}`); }
    if (FIELD_TYPES.includes(field_type as FieldType)) { vals.push(field_type); sets.push(`field_type=$${vals.length}`); }
    if (options !== undefined) { vals.push(options ? JSON.stringify(options) : null); sets.push(`options=$${vals.length}::jsonb`); }
    if (typeof is_required === 'boolean') { vals.push(is_required); sets.push(`is_required=$${vals.length}`); }
    if (Number.isFinite(sort_order)) { vals.push(Number(sort_order)); sets.push(`sort_order=$${vals.length}`); }
    if (typeof is_active === 'boolean') { vals.push(is_active); sets.push(`is_active=$${vals.length}`); }
    if (sets.length === 0) { res.status(400).json({ error: 'Nu s-a trimis nimic.' }); return; }
    vals.push(id, cid);
    const { rows } = await pool.query(
        `UPDATE pug_custom_fields SET ${sets.join(', ')}, updated_at=NOW()
          WHERE id=$${vals.length - 1} AND company_id=$${vals.length}
        RETURNING id, name, field_type, options, is_required, sort_order, is_active, created_at, updated_at`,
        vals
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Câmp inexistent.' }); return; }
    res.json({ field: rows[0] });
}));

router.delete('/custom-fields/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pug_custom_fields WHERE id=$1 AND company_id=$2', [id, cid]);
    if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Câmp inexistent.' }); return; }
    res.status(204).end();
}));

export default router;
