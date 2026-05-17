-- Migration 088: Project-scoped file attachments.
--
-- task_attachments is task-scoped (file_url tied to a task_id). For
-- architecture / GPR / consulting work, the most important files belong to
-- the PROJECT (contract PDF, site plan, permit, client deliverables) — not
-- to a single task. Until now those files had to be uploaded against a
-- task, even when they were really project-level.
--
-- Mirrors task_attachments shape but keyed by pug_project_id. Reuses the
-- existing /api/upload upload pipeline for actual blob storage (size limits
-- + virus scan live there); this table is metadata-only.

CREATE TABLE IF NOT EXISTS pug_project_attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pug_project_id  UUID NOT NULL REFERENCES pug_projects(id) ON DELETE CASCADE,
    file_name       VARCHAR(500) NOT NULL,
    file_url        TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    file_data       BYTEA,                  -- inline blob (same pattern as task_attachments)
    file_mime       TEXT,
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pug_project_attachments_project
    ON pug_project_attachments(pug_project_id);
CREATE INDEX IF NOT EXISTS idx_pug_project_attachments_company
    ON pug_project_attachments(company_id);
