-- Migration 091: Reusable PUG project templates.
--
-- Architecture / GPR / consulting work is highly templated — every house
-- permit project goes through the same 5–8 phases, every GPR survey
-- follows the same workflow. Today there's no way to "clone" a
-- known-good project setup; users hand-build stages and custom fields
-- from scratch for every new project.
--
-- A template is essentially a recipe: a name, a default work_type, and a
-- list of (stage_catalog_id, sort_order, default_deadline_offset_days)
-- entries. Instantiation creates a real pug_projects row and copies the
-- entries into pug_project_stages.

CREATE TABLE IF NOT EXISTS pug_project_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    work_type_id    UUID REFERENCES pug_work_types(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pug_project_templates_company
    ON pug_project_templates(company_id);

CREATE TABLE IF NOT EXISTS pug_project_template_stages (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id                 UUID NOT NULL REFERENCES pug_project_templates(id) ON DELETE CASCADE,
    stage_catalog_id            UUID NOT NULL REFERENCES pug_stage_catalog(id) ON DELETE CASCADE,
    sort_order                  INTEGER NOT NULL DEFAULT 0,
    -- Default deadline = project.start_date + this many days, applied at
    -- instantiation. Null = no preset deadline.
    default_deadline_offset_days INTEGER,
    UNIQUE (template_id, stage_catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_pug_template_stages_template
    ON pug_project_template_stages(template_id);
