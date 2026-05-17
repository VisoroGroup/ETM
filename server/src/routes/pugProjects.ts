import { Router, Response, NextFunction } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { tError } from '../utils/serverErrors';

/**
 * PUG project routes — CRUD + per-project stages, custom field values,
 * responsibles. All scoped to req.activeCompanyId.
 */
const router = Router();
router.use(authMiddleware);

function ensureCompany(req: AuthRequest, res: Response): number | null {
    const id = req.activeCompanyId;
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return null;
    }
    return id as number;
}

/**
 * Middleware: verify the active company has template_type='project'.
 * Applied to every mutation so non-project companies can't have PUG data
 * created/updated/deleted in them.
 */
async function ensureProjectTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const cid = req.activeCompanyId;
    if (!Number.isFinite(cid)) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const { rows } = await pool.query(
        `SELECT template_type FROM companies WHERE id = $1`,
        [cid]
    );
    if (rows.length === 0 || rows[0].template_type !== 'project') {
        res.status(400).json({ error: tError(req, 'company_no_project_support') });
        return;
    }
    next();
}

/** Compute the rolled-up status of a project from its stages. */
function rollupStatus(stages: { is_terminal: boolean | null; status_id: string | null }[]): 'new' | 'active' | 'closed' {
    const withStatus = stages.filter((s) => s.status_id);
    if (stages.length === 0 || withStatus.length === 0) return 'new';
    const allTerminal = withStatus.every((s) => s.is_terminal);
    if (allTerminal) return 'closed';
    return 'active';
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const includeArchived = req.query.archived === 'true';
    const { rows: projects } = await pool.query(
        `SELECT p.id, p.title, p.work_type_id, wt.name AS work_type_name,
                p.client_name, p.location, p.contract_number, p.contract_date,
                p.contract_amount, p.contract_currency, p.area_hectares,
                p.start_date, p.deadline, p.notes, p.is_archived,
                p.created_by, p.created_at, p.updated_at
           FROM pug_projects p
           LEFT JOIN pug_work_types wt ON wt.id = p.work_type_id
          WHERE p.company_id = $1 ${includeArchived ? '' : 'AND p.is_archived = false'}
          ORDER BY COALESCE(p.deadline, '9999-12-31'::date) ASC, p.created_at DESC`,
        [cid]
    );

    if (projects.length === 0) { res.json({ projects: [] }); return; }
    const ids = projects.map((p: any) => p.id);

    // Pull all stages + statuses for status rollup
    const { rows: stages } = await pool.query(
        `SELECT ps.project_id, ps.status_id, sc.is_terminal
           FROM pug_project_stages ps
           LEFT JOIN pug_status_catalog sc ON sc.id = ps.status_id
          WHERE ps.project_id = ANY($1::uuid[])`,
        [ids]
    );
    const stagesByProject: Record<string, any[]> = {};
    for (const s of stages) {
        (stagesByProject[s.project_id] ??= []).push(s);
    }

    // Pull responsibles
    const { rows: resps } = await pool.query(
        `SELECT r.project_id, u.id, u.display_name, u.avatar_url, u.email
           FROM pug_project_responsibles r
           JOIN users u ON u.id = r.user_id
          WHERE r.project_id = ANY($1::uuid[])`,
        [ids]
    );
    const respsByProject: Record<string, any[]> = {};
    for (const r of resps) {
        (respsByProject[r.project_id] ??= []).push({
            id: r.id, display_name: r.display_name, avatar_url: r.avatar_url, email: r.email,
        });
    }

    res.json({
        projects: projects.map((p: any) => ({
            ...p,
            status: rollupStatus(stagesByProject[p.id] ?? []),
            responsibles: respsByProject[p.id] ?? [],
        })),
    });
}));

// ---------------------------------------------------------------------------
// GET single — full details (project + stages + custom values + responsibles + tasks)
// ---------------------------------------------------------------------------
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;

    const { rows: pRows } = await pool.query(
        `SELECT p.*, wt.name AS work_type_name
           FROM pug_projects p
           LEFT JOIN pug_work_types wt ON wt.id = p.work_type_id
          WHERE p.id = $1 AND p.company_id = $2`,
        [id, cid]
    );
    if (pRows.length === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    const project = pRows[0];

    const [stagesRes, fieldValsRes, respsRes] = await Promise.all([
        pool.query(
            `SELECT ps.id, ps.stage_catalog_id, sc.name AS stage_name, sc.icon, sc.color,
                    ps.status_id, st.name AS status_name, st.color AS status_color,
                    st.is_terminal AS status_is_terminal,
                    ps.deadline, ps.sort_order, ps.notes, ps.created_at, ps.updated_at
               FROM pug_project_stages ps
               JOIN pug_stage_catalog sc ON sc.id = ps.stage_catalog_id
               LEFT JOIN pug_status_catalog st ON st.id = ps.status_id
              WHERE ps.project_id = $1
              ORDER BY ps.sort_order ASC, sc.sort_order ASC`,
            [id]
        ),
        pool.query(
            `SELECT field_id, value FROM pug_custom_field_values WHERE project_id = $1`,
            [id]
        ),
        pool.query(
            `SELECT u.id, u.display_name, u.avatar_url, u.email
               FROM pug_project_responsibles r
               JOIN users u ON u.id = r.user_id
              WHERE r.project_id = $1`,
            [id]
        ),
    ]);

    const stages = stagesRes.rows;
    const fieldValuesByField: Record<string, any> = {};
    for (const r of fieldValsRes.rows) fieldValuesByField[r.field_id] = r.value;

    res.json({
        project: {
            ...project,
            status: rollupStatus(stages.map((s: any) => ({ status_id: s.status_id, is_terminal: s.status_is_terminal }))),
            stages,
            custom_field_values: fieldValuesByField,
            responsibles: respsRes.rows,
        },
    });
}));

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
router.post('/', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const {
        title, work_type_id, client_name, location, contract_number, contract_date,
        contract_amount, contract_currency, area_hectares, start_date, deadline, notes,
        responsible_ids,
    } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: tError(req, 'project_title_required') });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `INSERT INTO pug_projects (company_id, title, work_type_id, client_name, location,
                                       contract_number, contract_date, contract_amount, contract_currency,
                                       area_hectares, start_date, deadline, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING id`,
            [
                cid, title.trim(), work_type_id ?? null, client_name ?? null, location ?? null,
                contract_number ?? null, contract_date ?? null, contract_amount ?? null,
                contract_currency ?? 'RON', area_hectares ?? null, start_date ?? null,
                deadline ?? null, notes ?? null, req.user?.id ?? null,
            ]
        );
        const newId = rows[0].id;

        // Auto-attach default stages with the initial status (if any).
        const { rows: defaultStages } = await client.query(
            `SELECT id FROM pug_stage_catalog WHERE company_id = $1 AND is_default = true AND is_active = true ORDER BY sort_order`,
            [cid]
        );
        const { rows: initialStatusRows } = await client.query(
            `SELECT id FROM pug_status_catalog WHERE company_id = $1 AND is_initial = true AND is_active = true LIMIT 1`,
            [cid]
        );
        const initialStatusId = initialStatusRows[0]?.id ?? null;
        for (let i = 0; i < defaultStages.length; i++) {
            await client.query(
                `INSERT INTO pug_project_stages (project_id, stage_catalog_id, status_id, sort_order)
                 VALUES ($1, $2, $3, $4)`,
                [newId, defaultStages[i].id, initialStatusId, (i + 1) * 10]
            );
        }

        // Responsibles (optional list of user ids) — must belong to the same company.
        if (Array.isArray(responsible_ids) && responsible_ids.length > 0) {
            const { rows: validRows } = await client.query<{ id: string }>(
                `SELECT u.id FROM users u
                  WHERE u.id = ANY($1::uuid[])
                    AND u.is_active = true
                    AND (u.role IN ('admin','superadmin')
                         OR EXISTS (SELECT 1 FROM user_companies uc
                                     WHERE uc.user_id = u.id AND uc.company_id = $2))`,
                [responsible_ids, cid]
            );
            const validIds = validRows.map((r) => r.id);
            if (validIds.length !== responsible_ids.length) {
                await client.query('ROLLBACK');
                res.status(400).json({ error: tError(req, 'users_not_in_company') });
                return;
            }
            const valuesSql = validIds.map((_: string, i: number) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO pug_project_responsibles (project_id, user_id) VALUES ${valuesSql} ON CONFLICT DO NOTHING`,
                [newId, ...validIds]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ project_id: newId });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// ---------------------------------------------------------------------------
// UPDATE main fields
// ---------------------------------------------------------------------------
router.put('/:id', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const fields = [
        'title', 'work_type_id', 'client_name', 'location', 'contract_number',
        'contract_date', 'contract_amount', 'contract_currency', 'area_hectares',
        'start_date', 'deadline', 'notes',
    ];
    const sets: string[] = []; const vals: any[] = [];
    for (const f of fields) {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, f)) {
            vals.push(req.body[f]); sets.push(`${f}=$${vals.length}`);
        }
    }
    if (sets.length === 0) { res.status(400).json({ error: tError(req, 'nothing_to_update') }); return; }
    vals.push(id, cid);
    const { rows } = await pool.query(
        `UPDATE pug_projects SET ${sets.join(', ')}, updated_at=NOW()
          WHERE id=$${vals.length - 1} AND company_id=$${vals.length}
        RETURNING id`,
        vals
    );
    if (rows.length === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// ARCHIVE / RESTORE
// ---------------------------------------------------------------------------
router.patch('/:id/archive', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const archive = req.body?.archive !== false;
    const { rowCount } = await pool.query(
        `UPDATE pug_projects SET is_archived = $1, updated_at=NOW() WHERE id=$2 AND company_id=$3`,
        [archive, req.params.id, cid]
    );
    if ((rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// STAGE management on a project
// ---------------------------------------------------------------------------
router.post('/:id/stages', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id: projectId } = req.params;
    const { stage_catalog_id, status_id, deadline, sort_order, notes } = req.body ?? {};
    // Verify project tenancy.
    const { rowCount: pCount } = await pool.query(
        'SELECT 1 FROM pug_projects WHERE id=$1 AND company_id=$2', [projectId, cid]
    );
    if ((pCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    if (!stage_catalog_id) { res.status(400).json({ error: tError(req, 'stage_catalog_required') }); return; }
    // Verify stage_catalog_id belongs to the active company — prevents
    // crafted payloads from referencing another company's catalog rows.
    const { rowCount: stageCatCount } = await pool.query(
        'SELECT 1 FROM pug_stage_catalog WHERE id = $1 AND company_id = $2',
        [stage_catalog_id, cid]
    );
    if ((stageCatCount ?? 0) === 0) {
        res.status(400).json({ error: tError(req, 'stage_not_in_company') });
        return;
    }
    if (status_id) {
        const { rowCount: statusCount } = await pool.query(
            'SELECT 1 FROM pug_status_catalog WHERE id = $1 AND company_id = $2',
            [status_id, cid]
        );
        if ((statusCount ?? 0) === 0) {
            res.status(400).json({ error: tError(req, 'status_not_in_company') });
            return;
        }
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO pug_project_stages (project_id, stage_catalog_id, status_id, deadline, sort_order, notes)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING id`,
            [projectId, stage_catalog_id, status_id ?? null, deadline ?? null, Number.isFinite(sort_order) ? sort_order : 999, notes ?? null]
        );
        res.status(201).json({ stage_id: rows[0].id });
    } catch (err: any) {
        if (err?.code === '23505') {
            res.status(409).json({ error: tError(req, 'stage_already_attached') });
            return;
        }
        throw err;
    }
}));

router.put('/:projectId/stages/:stageId', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { projectId, stageId } = req.params;
    const { status_id, deadline, sort_order, notes } = req.body ?? {};
    // Verify status_id belongs to the active company if a non-null value is supplied.
    if (status_id) {
        const { rowCount: statusCount } = await pool.query(
            'SELECT 1 FROM pug_status_catalog WHERE id = $1 AND company_id = $2',
            [status_id, cid]
        );
        if ((statusCount ?? 0) === 0) {
            res.status(400).json({ error: tError(req, 'status_not_in_company') });
            return;
        }
    }
    const sets: string[] = []; const vals: any[] = [];
    if (status_id !== undefined) { vals.push(status_id || null); sets.push(`status_id=$${vals.length}`); }
    if (deadline !== undefined) { vals.push(deadline || null); sets.push(`deadline=$${vals.length}`); }
    if (Number.isFinite(sort_order)) { vals.push(Number(sort_order)); sets.push(`sort_order=$${vals.length}`); }
    if (notes !== undefined) { vals.push(notes ?? null); sets.push(`notes=$${vals.length}`); }
    if (sets.length === 0) { res.status(400).json({ error: tError(req, 'nothing_to_update') }); return; }
    vals.push(stageId, projectId);
    // Verify tenancy via the JOIN.
    const tenant = await pool.query(
        'SELECT 1 FROM pug_projects WHERE id=$1 AND company_id=$2',
        [projectId, cid]
    );
    if ((tenant.rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    const { rowCount } = await pool.query(
        `UPDATE pug_project_stages SET ${sets.join(', ')}, updated_at=NOW()
          WHERE id=$${vals.length - 1} AND project_id=$${vals.length}`,
        vals
    );
    if ((rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'stage_not_found') }); return; }

    // If the deadline moved, drop the reminder log so future levels can fire
    // again. Without this, a stage whose deadline slips to a later date would
    // never receive its d14/d7/d1 reminders again because the UNIQUE constraint
    // (project_stage_id, level) keeps the old "already sent" rows.
    if (deadline !== undefined) {
        await pool.query(
            'DELETE FROM pug_stage_reminder_log WHERE project_stage_id = $1',
            [stageId]
        );
    }

    res.json({ ok: true });
}));

router.delete('/:projectId/stages/:stageId', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { projectId, stageId } = req.params;
    const tenant = await pool.query(
        'SELECT 1 FROM pug_projects WHERE id=$1 AND company_id=$2',
        [projectId, cid]
    );
    if ((tenant.rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    const result = await pool.query(
        'DELETE FROM pug_project_stages WHERE id=$1 AND project_id=$2',
        [stageId, projectId]
    );
    if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'stage_not_found') }); return; }
    res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Custom field values bulk-set
// ---------------------------------------------------------------------------
router.put('/:id/custom-fields', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id: projectId } = req.params;
    const values = req.body?.values; // { [field_id]: any }
    if (typeof values !== 'object' || values === null || Array.isArray(values)) {
        res.status(400).json({ error: tError(req, 'values_must_be_object') });
        return;
    }
    const tenant = await pool.query(
        'SELECT 1 FROM pug_projects WHERE id=$1 AND company_id=$2', [projectId, cid]
    );
    if ((tenant.rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }
    // Verify every field_id belongs to the active company. Reject all if any
    // is invalid — partial saves would leave the project in a half-set state.
    const fieldIds = Object.keys(values);
    if (fieldIds.length > 0) {
        const { rows: validFields } = await pool.query<{ id: string }>(
            'SELECT id FROM pug_custom_fields WHERE id = ANY($1::uuid[]) AND company_id = $2',
            [fieldIds, cid]
        );
        const validSet = new Set(validFields.map((r) => r.id));
        const invalid = fieldIds.filter((fid) => !validSet.has(fid));
        if (invalid.length > 0) {
            res.status(400).json({ error: tError(req, 'fields_not_in_company') });
            return;
        }
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const [fieldId, value] of Object.entries(values)) {
            await client.query(
                `INSERT INTO pug_custom_field_values (project_id, field_id, value)
                 VALUES ($1, $2, $3::jsonb)
                 ON CONFLICT (project_id, field_id)
                 DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [projectId, fieldId, JSON.stringify(value)]
            );
        }
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// ---------------------------------------------------------------------------
// Responsibles
// ---------------------------------------------------------------------------
router.put('/:id/responsibles', requireRole('admin'), asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id: projectId } = req.params;
    const ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids : null;
    if (!ids) { res.status(400).json({ error: tError(req, 'user_ids_required') }); return; }
    const tenant = await pool.query(
        'SELECT 1 FROM pug_projects WHERE id=$1 AND company_id=$2', [projectId, cid]
    );
    if ((tenant.rowCount ?? 0) === 0) { res.status(404).json({ error: tError(req, 'project_not_found') }); return; }

    // Tenant guard: every user_id must belong to the project's company (via
    // user_companies) OR be a superadmin/admin (cross-company by definition).
    if (ids.length > 0) {
        const { rows: validRows } = await pool.query<{ id: string }>(
            `SELECT u.id FROM users u
              WHERE u.id = ANY($1::uuid[])
                AND u.is_active = true
                AND (u.role IN ('admin','superadmin')
                     OR EXISTS (SELECT 1 FROM user_companies uc
                                 WHERE uc.user_id = u.id AND uc.company_id = $2))`,
            [ids, cid]
        );
        const validSet = new Set(validRows.map((r) => r.id));
        const invalid = ids.filter((id: string) => !validSet.has(id));
        if (invalid.length > 0) {
            res.status(400).json({ error: tError(req, 'users_not_in_company'), invalid });
            return;
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM pug_project_responsibles WHERE project_id = $1', [projectId]);
        if (ids.length > 0) {
            const valuesSql = ids.map((_: string, i: number) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO pug_project_responsibles (project_id, user_id) VALUES ${valuesSql} ON CONFLICT DO NOTHING`,
                [projectId, ...ids]
            );
        }
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// ---------------------------------------------------------------------------
// PROJECT ATTACHMENTS — project-scoped files (contract PDF, plans, permits).
// task_attachments is per-task; for architecture / GPR work the most
// important files are project-level, not task-level. Reuses /api/upload for
// actual blob storage; this is metadata only.
// ---------------------------------------------------------------------------

router.get('/:id/attachments', asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;

    // Tenant guard: project must belong to active company.
    const { rows: pcheck } = await pool.query(
        `SELECT 1 FROM pug_projects WHERE id = $1 AND company_id = $2`,
        [id, cid]
    );
    if (pcheck.length === 0) {
        res.status(404).json({ error: tError(req, 'pug_project_not_found') });
        return;
    }

    const { rows } = await pool.query(
        `SELECT a.id, a.pug_project_id, a.file_name, a.file_url, a.file_size,
                a.uploaded_by, a.created_at,
                u.display_name AS uploaded_by_name
           FROM pug_project_attachments a
           JOIN users u ON a.uploaded_by = u.id
          WHERE a.pug_project_id = $1 AND a.company_id = $2
          ORDER BY a.created_at DESC`,
        [id, cid]
    );
    res.json(rows);
}));

router.post('/:id/attachments', asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id } = req.params;
    const { file_name, file_url, file_size } = req.body as {
        file_name?: string; file_url?: string; file_size?: number;
    };

    const { rows: pcheck } = await pool.query(
        `SELECT 1 FROM pug_projects WHERE id = $1 AND company_id = $2`,
        [id, cid]
    );
    if (pcheck.length === 0) {
        res.status(404).json({ error: tError(req, 'pug_project_not_found') });
        return;
    }
    if (!file_name || !file_url || typeof file_size !== 'number') {
        res.status(400).json({ error: tError(req, 'attachment_fields_required') });
        return;
    }

    const { rows } = await pool.query(
        `INSERT INTO pug_project_attachments
              (pug_project_id, file_name, file_url, file_size, uploaded_by, company_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, file_name, file_url, file_size, req.user!.id, cid]
    );
    res.status(201).json(rows[0]);
}));

router.delete('/:id/attachments/:attachmentId', asyncHandler(ensureProjectTemplate), asyncHandler(async (req: AuthRequest, res: Response) => {
    const cid = ensureCompany(req, res); if (cid === null) return;
    const { id, attachmentId } = req.params;
    await pool.query(
        `DELETE FROM pug_project_attachments
          WHERE id = $1 AND pug_project_id = $2 AND company_id = $3`,
        [attachmentId, id, cid]
    );
    res.status(204).send();
}));

export default router;
