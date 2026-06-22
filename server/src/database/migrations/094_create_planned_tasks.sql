-- Migration 094: Weekly / monthly planner — user-curated task selections.
--
-- The existing day/week view and monthly report list tasks automatically by
-- due_date. The planner is different: a user MANUALLY picks which existing
-- tasks they intend to work on this week (or month), regardless of due_date.
--
-- Key design decisions (see PRPs/004-weekly-monthly-planner.md):
--   * This is a SEPARATE layer over tasks — it never touches tasks.due_date.
--     A task due in July can sit in this week's plan.
--   * scope = 'week'  -> period_start is the Monday of that week.
--     scope = 'month' -> period_start is the 1st of that month (a task added
--     DIRECTLY to the month, not via a week).
--   * The monthly plan is COMPUTED, not duplicated: the month view = all
--     scope='month' rows for that month UNION all scope='week' rows whose
--     period_start falls inside that month. So a weekly pick automatically
--     shows up in the month without writing a second row.
--   * Tenant-scoped like every other table: company_id filters every query.

CREATE TABLE IF NOT EXISTS planned_tasks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id    INTEGER NOT NULL REFERENCES companies(id),
    -- 'week' = picked for a specific week; 'month' = picked directly for a month.
    scope         TEXT NOT NULL CHECK (scope IN ('week', 'month')),
    -- Monday of the week (scope='week') or 1st of the month (scope='month').
    period_start  DATE NOT NULL,
    -- TRUE when the rollover cron carried this row forward from a previous
    -- period (vs. a fresh manual pick). The planner UI badges these rows.
    rolled_over   BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    -- A task appears at most once per user, per scope, per period.
    UNIQUE (user_id, task_id, scope, period_start)
);

-- "My plan" lookups: a user's items for a given scope + period, within a company.
CREATE INDEX IF NOT EXISTS idx_planned_tasks_user
    ON planned_tasks(user_id, company_id, scope, period_start);

-- Company overview (whitelist viewers): everyone's items for a scope + period.
CREATE INDEX IF NOT EXISTS idx_planned_tasks_company
    ON planned_tasks(company_id, scope, period_start);

-- Reverse lookup by task (e.g. cleanup, "is this task planned by anyone").
CREATE INDEX IF NOT EXISTS idx_planned_tasks_task
    ON planned_tasks(task_id);
