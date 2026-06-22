import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { tError } from '../utils/serverErrors';
import { PlannedItem, PlannerCompanyUser } from '../types';

const router = Router();

// Access model (mirrors dayView.ts):
//   * requireRole('user') = "any authenticated member" (ROLE_INHERITANCE lets
//     every role through). Tenant isolation is enforced per-query via
//     req.activeCompanyId — no company resolved => empty result, never a leak.
//   * The /company/* overview is gated ON TOP of that by an explicit
//     user-id whitelist (COMPANY_PLAN_VIEWER_IDS), NOT by role. A different
//     admin/manager does NOT see it. This is Robert's decision (PRP 004 §6).

// Exactly three people may see the company-wide planner overview. This is a
// user-whitelist, not a role gate (PRP 004, 2026-06-22):
//   12c31954-6e1e-476d-a077-4e3dc635bef6  Ledenyi Emoke   (admin)
//   e2be1cdd-223e-403f-aa2b-cb0cb950b817  Robert LEDENYI  (superadmin)
//   da0fb403-6436-44aa-95b5-f46ff6569856  Maria VASZI     (admin)
const COMPANY_PLAN_VIEWER_IDS = new Set<string>([
    '12c31954-6e1e-476d-a077-4e3dc635bef6', // Ledenyi Emoke
    'e2be1cdd-223e-403f-aa2b-cb0cb950b817', // Robert LEDENYI
    'da0fb403-6436-44aa-95b5-f46ff6569856', // Maria VASZI
]);

function canViewCompanyPlan(userId: string | undefined): boolean {
    return userId !== undefined && COMPANY_PLAN_VIEWER_IDS.has(userId);
}

// SELECT/JOIN fragment shared by every "list planned items" query. Returns the
// task fields needed to render a planner row. Soft-deleted tasks are excluded
// (deleted_at IS NULL) — the ON DELETE CASCADE on planned_tasks only fires for
// hard deletes, so the JOIN filter is what keeps soft-deleted tasks out.
const PLANNED_ITEM_SELECT = `
    SELECT pt.task_id, pt.scope, pt.period_start::text AS period_start, pt.rolled_over,
           t.title, t.status, t.due_date::text AS due_date,
           t.department_label, t.assigned_to,
           au.display_name AS assignee_name
      FROM planned_tasks pt
      JOIN tasks t ON t.id = pt.task_id AND t.deleted_at IS NULL
      LEFT JOIN users au ON au.id = t.assigned_to
`;

// Map a raw planned-item DB row to the API shape (drops nothing; just types it).
function toPlannedItem(row: any): PlannedItem {
    return {
        task_id: row.task_id,
        title: row.title,
        status: row.status,
        due_date: row.due_date,
        department_label: row.department_label ?? null,
        assigned_to: row.assigned_to ?? null,
        assignee_name: row.assignee_name ?? null,
        scope: row.scope,
        period_start: row.period_start,
        rolled_over: row.rolled_over ?? false,
    };
}

// Compute the 1st and the 1st-of-next-month bounds for a YYYY-MM string.
// We keep the bounds as YYYY-MM-DD strings and compare against period_start so
// the month union (scope='month' for this month + scope='week' weeks inside it)
// is a single half-open range check.
function monthBounds(month: string): { firstOfMonth: string; firstOfNextMonth: string } {
    const [year, m] = month.split('-').map(Number);
    const firstOfMonth = `${year}-${String(m).padStart(2, '0')}-01`;
    const nextYear = m === 12 ? year + 1 : year;
    const nextMonth = m === 12 ? 1 : m + 1;
    const firstOfNextMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return { firstOfMonth, firstOfNextMonth };
}

// Resolve the task ids (from a request body) the caller is allowed to plan, for
// the active company. The pull-in set (PRP 004 §5) is: the task is in the active
// company (not soft-deleted) AND (it is assigned_to the user OR the user has a
// subtask assigned on it). Returns only the permitted ids — callers insert just
// those, so a crafted id from another tenant / not-theirs is silently dropped.
async function resolvePlannableTaskIds(
    taskIds: string[],
    userId: string,
    companyId: number,
): Promise<string[]> {
    if (taskIds.length === 0) return [];
    const { rows } = await pool.query<{ id: string }>(
        `SELECT DISTINCT t.id
           FROM tasks t
          WHERE t.id = ANY($1::uuid[])
            AND t.company_id = $2
            AND t.deleted_at IS NULL
            AND (
                t.assigned_to = $3
                OR EXISTS (
                    SELECT 1 FROM subtasks s
                     WHERE s.task_id = t.id
                       AND s.assigned_to = $3
                       AND s.company_id = $2
                       AND s.deleted_at IS NULL
                )
            )`,
        [taskIds, companyId, userId]
    );
    return rows.map((r) => r.id);
}

// Validate a request body of the form { task_ids: string[] }. Returns the array
// or null (and the caller responds 400). We cap the batch to a sane size.
function parseTaskIds(body: any): string[] | null {
    const ids = body?.task_ids;
    if (!Array.isArray(ids)) return null;
    if (ids.length > 500) return null;
    if (!ids.every((x) => typeof x === 'string' && x.length > 0)) return null;
    return ids;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

// GET /api/planner/week?start=YYYY-MM-DD
// The logged-in user's plan for the week starting at `start`. `start` is used
// verbatim as period_start — the client supplies the Monday, matching the
// existing week-view convention so both refer to the same week.
router.get('/week', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    const start = (req.query.start as string) || '';
    if (!YMD.test(start)) {
        res.status(400).json({ error: tError(req, 'invalid_date_format_ymd') });
        return;
    }
    if (companyId === undefined) {
        res.json({ start, end: start, items: [] });
        return;
    }

    const { rows } = await pool.query(
        `${PLANNED_ITEM_SELECT}
          WHERE pt.user_id = $1 AND pt.company_id = $2
            AND pt.scope = 'week' AND pt.period_start = $3
          ORDER BY t.due_date ASC, t.title ASC`,
        [req.user!.id, companyId, start]
    );

    const [y, m, d] = start.split('-').map(Number);
    const endDate = new Date(y, m - 1, d + 6);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    res.json({ start, end, items: rows.map(toPlannedItem) });
}));

// GET /api/planner/month?month=YYYY-MM
// The logged-in user's monthly plan, COMPUTED as the union of: every
// scope='month' row for this month, plus every scope='week' row whose
// period_start falls inside this month. No second row is written for weekly
// picks — they show up here automatically (PRP 004, migration 094).
router.get('/month', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    const month = (req.query.month as string) || '';
    if (!YM.test(month)) {
        res.status(400).json({ error: tError(req, 'invalid_month_format') });
        return;
    }
    if (companyId === undefined) {
        res.json({ month, items: [] });
        return;
    }

    const { firstOfMonth, firstOfNextMonth } = monthBounds(month);
    const { rows } = await pool.query(
        `${PLANNED_ITEM_SELECT}
          WHERE pt.user_id = $1 AND pt.company_id = $2
            AND (
                (pt.scope = 'month' AND pt.period_start = $3)
                OR (pt.scope = 'week' AND pt.period_start >= $3 AND pt.period_start < $4)
            )
          ORDER BY t.due_date ASC, t.title ASC`,
        [req.user!.id, companyId, firstOfMonth, firstOfNextMonth]
    );
    res.json({ month, items: rows.map(toPlannedItem) });
}));

// POST /api/planner/week  body { start, task_ids[] }
// Add the selected tasks to the week's plan. Idempotent via the UNIQUE
// constraint (ON CONFLICT DO NOTHING). Only tasks the caller may plan
// (resolvePlannableTaskIds) are inserted. Returns { added } = rows inserted.
router.post('/week', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const start = req.body?.start;
    if (typeof start !== 'string' || !YMD.test(start)) {
        res.status(400).json({ error: tError(req, 'invalid_date_format_ymd') });
        return;
    }
    const taskIds = parseTaskIds(req.body);
    if (taskIds === null) {
        res.status(400).json({ error: tError(req, 'planner_task_ids_required') });
        return;
    }

    const allowed = await resolvePlannableTaskIds(taskIds, req.user!.id, companyId);
    if (allowed.length === 0) {
        res.json({ added: 0 });
        return;
    }

    const { rowCount } = await pool.query(
        `INSERT INTO planned_tasks (task_id, user_id, company_id, scope, period_start)
         SELECT tid, $1, $2, 'week', $3
           FROM unnest($4::uuid[]) AS tid
         ON CONFLICT (user_id, task_id, scope, period_start) DO NOTHING`,
        [req.user!.id, companyId, start, allowed]
    );
    res.json({ added: rowCount ?? 0 });
}));

// POST /api/planner/month  body { month, task_ids[] }
// Add the selected tasks DIRECTLY to the month's plan (scope='month'). Same
// validation + idempotency as the weekly add.
router.post('/month', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const month = req.body?.month;
    if (typeof month !== 'string' || !YM.test(month)) {
        res.status(400).json({ error: tError(req, 'invalid_month_format') });
        return;
    }
    const taskIds = parseTaskIds(req.body);
    if (taskIds === null) {
        res.status(400).json({ error: tError(req, 'planner_task_ids_required') });
        return;
    }

    const allowed = await resolvePlannableTaskIds(taskIds, req.user!.id, companyId);
    if (allowed.length === 0) {
        res.json({ added: 0 });
        return;
    }

    const { firstOfMonth } = monthBounds(month);
    const { rowCount } = await pool.query(
        `INSERT INTO planned_tasks (task_id, user_id, company_id, scope, period_start)
         SELECT tid, $1, $2, 'month', $3
           FROM unnest($4::uuid[]) AS tid
         ON CONFLICT (user_id, task_id, scope, period_start) DO NOTHING`,
        [req.user!.id, companyId, firstOfMonth, allowed]
    );
    res.json({ added: rowCount ?? 0 });
}));

// DELETE /api/planner/week/:taskId?start=YYYY-MM-DD
// Remove one task from the caller's weekly plan for that week. Tenant-scoped by
// company_id + user_id, so a caller can only delete their own rows.
router.delete('/week/:taskId', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const start = (req.query.start as string) || '';
    if (!YMD.test(start)) {
        res.status(400).json({ error: tError(req, 'invalid_date_format_ymd') });
        return;
    }
    const { rowCount } = await pool.query(
        `DELETE FROM planned_tasks
          WHERE user_id = $1 AND company_id = $2
            AND scope = 'week' AND period_start = $3 AND task_id = $4`,
        [req.user!.id, companyId, start, req.params.taskId]
    );
    res.json({ removed: rowCount ?? 0 });
}));

// DELETE /api/planner/month/:taskId?month=YYYY-MM
// Remove one task from the caller's DIRECT monthly plan (scope='month'). Weekly
// picks that surface in the month view are removed via the weekly endpoint.
router.delete('/month/:taskId', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;
    if (companyId === undefined) {
        res.status(400).json({ error: tError(req, 'company_missing') });
        return;
    }
    const month = (req.query.month as string) || '';
    if (!YM.test(month)) {
        res.status(400).json({ error: tError(req, 'invalid_month_format') });
        return;
    }
    const { firstOfMonth } = monthBounds(month);
    const { rowCount } = await pool.query(
        `DELETE FROM planned_tasks
          WHERE user_id = $1 AND company_id = $2
            AND scope = 'month' AND period_start = $3 AND task_id = $4`,
        [req.user!.id, companyId, firstOfMonth, req.params.taskId]
    );
    res.json({ removed: rowCount ?? 0 });
}));

// GET /api/planner/can-view-company
// Lets the frontend decide whether to show the "company overview" toggle. The
// answer is the whitelist membership (NOT a role check).
router.get('/can-view-company', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ allowed: canViewCompanyPlan(req.user!.id) });
}));

// Group flat planned-item rows (each carrying user_id + display_name) into the
// per-user buckets the company overview returns, preserving user ordering.
function groupByUser(rows: any[]): PlannerCompanyUser[] {
    const order: string[] = [];
    const map = new Map<string, PlannerCompanyUser>();
    for (const row of rows) {
        let bucket = map.get(row.user_id);
        if (!bucket) {
            bucket = { user_id: row.user_id, display_name: row.display_name, items: [] };
            map.set(row.user_id, bucket);
            order.push(row.user_id);
        }
        bucket.items.push(toPlannedItem(row));
    }
    return order.map((id) => map.get(id)!);
}

// The company overview SELECT: like PLANNED_ITEM_SELECT but also carries the
// planner-owner (pu) so we can group by user. Soft-deleted tasks excluded.
const COMPANY_ITEM_SELECT = `
    SELECT pt.user_id, pu.display_name,
           pt.task_id, pt.scope, pt.period_start::text AS period_start, pt.rolled_over,
           t.title, t.status, t.due_date::text AS due_date,
           t.department_label, t.assigned_to,
           au.display_name AS assignee_name
      FROM planned_tasks pt
      JOIN users pu ON pu.id = pt.user_id
      JOIN tasks t ON t.id = pt.task_id AND t.deleted_at IS NULL
      LEFT JOIN users au ON au.id = t.assigned_to
`;

// GET /api/planner/company/week?start=YYYY-MM-DD
// Everyone's weekly plan in the active company, grouped by user. Whitelist-only
// (403 otherwise). Still tenant-scoped: company_id = req.activeCompanyId.
router.get('/company/week', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!canViewCompanyPlan(req.user!.id)) {
        res.status(403).json({ error: tError(req, 'no_permission') });
        return;
    }
    const companyId = req.activeCompanyId;
    const start = (req.query.start as string) || '';
    if (!YMD.test(start)) {
        res.status(400).json({ error: tError(req, 'invalid_date_format_ymd') });
        return;
    }
    if (companyId === undefined) {
        res.json({ start, end: start, users: [] });
        return;
    }

    const { rows } = await pool.query(
        `${COMPANY_ITEM_SELECT}
          WHERE pt.company_id = $1
            AND pt.scope = 'week' AND pt.period_start = $2
          ORDER BY pu.display_name ASC, t.due_date ASC, t.title ASC`,
        [companyId, start]
    );

    const [y, m, d] = start.split('-').map(Number);
    const endDate = new Date(y, m - 1, d + 6);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    res.json({ start, end, users: groupByUser(rows) });
}));

// GET /api/planner/company/month?month=YYYY-MM
// Everyone's monthly plan (same UNION rule as /month) grouped by user.
// Whitelist-only (403 otherwise), tenant-scoped.
router.get('/company/month', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!canViewCompanyPlan(req.user!.id)) {
        res.status(403).json({ error: tError(req, 'no_permission') });
        return;
    }
    const companyId = req.activeCompanyId;
    const month = (req.query.month as string) || '';
    if (!YM.test(month)) {
        res.status(400).json({ error: tError(req, 'invalid_month_format') });
        return;
    }
    if (companyId === undefined) {
        res.json({ month, users: [] });
        return;
    }

    const { firstOfMonth, firstOfNextMonth } = monthBounds(month);
    const { rows } = await pool.query(
        `${COMPANY_ITEM_SELECT}
          WHERE pt.company_id = $1
            AND (
                (pt.scope = 'month' AND pt.period_start = $2)
                OR (pt.scope = 'week' AND pt.period_start >= $2 AND pt.period_start < $3)
            )
          ORDER BY pu.display_name ASC, t.due_date ASC, t.title ASC`,
        [companyId, firstOfMonth, firstOfNextMonth]
    );
    res.json({ month, users: groupByUser(rows) });
}));

export default router;
