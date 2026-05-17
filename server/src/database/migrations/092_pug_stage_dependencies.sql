-- Migration 092: Stage dependencies for PUG projects.
--
-- Migration 073 documented that stages were intentionally independent —
-- "they can run in parallel". For real architecture work this is wrong:
-- Tervezés → Egyeztetés → Engedélyezés → Kivitelezés is a sequence, and
-- the UI should make that visible. A self-referential join table on
-- pug_project_stages models a precedes-relation.
--
-- Cycle prevention is enforced at the application layer (the route refuses
-- a dependency that would create a cycle) — Postgres has no cheap built-in
-- DAG check without recursive CTEs at every insert.

CREATE TABLE IF NOT EXISTS pug_stage_dependencies (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL REFERENCES pug_projects(id) ON DELETE CASCADE,
    -- The blocking stage must finish before the blocked stage can start.
    blocking_stage_id UUID NOT NULL REFERENCES pug_project_stages(id) ON DELETE CASCADE,
    blocked_stage_id  UUID NOT NULL REFERENCES pug_project_stages(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, blocking_stage_id, blocked_stage_id),
    CHECK (blocking_stage_id <> blocked_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_pug_stage_deps_project_blocked
    ON pug_stage_dependencies(project_id, blocked_stage_id);
CREATE INDEX IF NOT EXISTS idx_pug_stage_deps_project_blocking
    ON pug_stage_dependencies(project_id, blocking_stage_id);
