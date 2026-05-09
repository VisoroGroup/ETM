-- Migration 073: Visoro Neo Plan PUG module — projects, stages, statuses,
-- custom fields, and the task↔stage join.
--
-- Per the spec:
--   - Stage catalog and status catalog are scoped to a company (one Neo Plan
--     today, but ready for future 'project'-template companies).
--   - A project (PUG) has many stages, each with its own status + deadline.
--     Stages are independent — they can run in parallel, no fixed order.
--   - Custom fields are admin-defined per company; each project stores values.
--   - A task can be linked to multiple stages of the same project.
--
-- All tables get company_id (project-template companies — Neo Plan today).

-- ===========================================================================
-- 1) Stage catalog — admin manages this list (e.g. Tervezés, Egyeztetés…)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_stage_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    icon            TEXT,                                  -- lucide icon name (optional)
    color           TEXT NOT NULL DEFAULT '#3B82F6',
    sort_order      INTEGER NOT NULL DEFAULT 999,
    is_default      BOOLEAN NOT NULL DEFAULT false,        -- auto-attach on new projects
    is_active       BOOLEAN NOT NULL DEFAULT true,         -- soft-disable
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pug_stage_catalog_company    ON pug_stage_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_pug_stage_catalog_sort       ON pug_stage_catalog(company_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pug_stage_catalog_default    ON pug_stage_catalog(company_id, is_default) WHERE is_default = true;

-- ===========================================================================
-- 2) Status catalog — admin manages the per-stage status options
--    (e.g. Nem indult, Folyamatban, Kész). Each project stage picks one.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_status_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#6B7280',
    sort_order      INTEGER NOT NULL DEFAULT 999,
    is_initial      BOOLEAN NOT NULL DEFAULT false,        -- default for newly-attached stages
    is_terminal     BOOLEAN NOT NULL DEFAULT false,        -- "done" markers for project-rollup
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pug_status_catalog_company  ON pug_status_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_pug_status_catalog_sort     ON pug_status_catalog(company_id, sort_order);

-- ===========================================================================
-- 3) Work types — admin manages (PUG / PUZ / etc.)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_work_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 999,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pug_work_types_company ON pug_work_types(company_id);

-- ===========================================================================
-- 4) Custom field definitions — admin defines per company
--    types: 'text' | 'number' | 'date' | 'boolean' | 'select'
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_custom_fields (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    field_type      TEXT NOT NULL,
    options         JSONB,                                 -- for 'select' type: array of options
    is_required     BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 999,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pug_custom_fields_company ON pug_custom_fields(company_id);

-- ===========================================================================
-- 5) Projects (PUG-ok)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    work_type_id        UUID REFERENCES pug_work_types(id) ON DELETE SET NULL,
    client_name         TEXT,                              -- ügyfél (önkormányzat) neve
    location            TEXT,                              -- helyszín
    contract_number     TEXT,
    contract_date       DATE,
    contract_amount     NUMERIC(14,2),
    contract_currency   TEXT DEFAULT 'RON',
    area_hectares       NUMERIC(10,2),                     -- terület mérete (ha)
    start_date          DATE,
    deadline            DATE,                              -- globális határidő
    notes               TEXT,                              -- belső megjegyzések
    is_archived         BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pug_projects_company   ON pug_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_pug_projects_deadline  ON pug_projects(deadline);
CREATE INDEX IF NOT EXISTS idx_pug_projects_archived  ON pug_projects(is_archived);

-- ===========================================================================
-- 6) Project responsibles (many users per project, equal rights)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_project_responsibles (
    project_id  UUID NOT NULL REFERENCES pug_projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pug_project_responsibles_user ON pug_project_responsibles(user_id);

-- ===========================================================================
-- 7) Project stages — instance of a stage on a specific project
--    Each stage has its own status + deadline. Stages are independent.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_project_stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES pug_projects(id)        ON DELETE CASCADE,
    stage_catalog_id    UUID NOT NULL REFERENCES pug_stage_catalog(id)   ON DELETE RESTRICT,
    status_id           UUID REFERENCES pug_status_catalog(id)           ON DELETE SET NULL,
    deadline            DATE,
    sort_order          INTEGER NOT NULL DEFAULT 999,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, stage_catalog_id)                  -- a stage may only appear once per project
);
CREATE INDEX IF NOT EXISTS idx_pug_project_stages_project   ON pug_project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_pug_project_stages_deadline  ON pug_project_stages(deadline);
CREATE INDEX IF NOT EXISTS idx_pug_project_stages_status    ON pug_project_stages(status_id);

-- ===========================================================================
-- 8) Custom field values — one row per (project, custom field).
--    Stored as JSONB to allow any of the supported types.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pug_custom_field_values (
    project_id  UUID NOT NULL REFERENCES pug_projects(id)        ON DELETE CASCADE,
    field_id    UUID NOT NULL REFERENCES pug_custom_fields(id)   ON DELETE CASCADE,
    value       JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, field_id)
);

-- ===========================================================================
-- 9) Task ↔ Stage many-to-many. A task may be linked to multiple stages of
--    its parent project. (PUG-scoped tasks are the bulk; standalone "company
--    management" tasks are also valid — they simply have no rows here.)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS task_stages (
    task_id     UUID NOT NULL REFERENCES tasks(id)               ON DELETE CASCADE,
    stage_id    UUID NOT NULL REFERENCES pug_project_stages(id)  ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, stage_id)
);
CREATE INDEX IF NOT EXISTS idx_task_stages_stage ON task_stages(stage_id);

-- ===========================================================================
-- 10) Optional: link a task directly to a project (so tasks not bound to any
--     stage can still be filtered by project — e.g. management tasks aren't
--     in stages but belong to "this PUG").
-- ===========================================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pug_project_id UUID REFERENCES pug_projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_pug_project ON tasks(pug_project_id);
