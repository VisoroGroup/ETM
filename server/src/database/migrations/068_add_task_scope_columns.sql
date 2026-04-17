-- Migration 068: Allow tasks to be scoped to a Department head or Section head,
-- not only to a Post. A task now carries EXACTLY ONE of:
--   assigned_post_id        → task belongs to a specific post (the most common case)
--   assigned_section_id     → task belongs to the section (subdepartment) head
--   assigned_department_id  → task belongs to the department head
--
-- No CHECK constraint is enforced yet — validation lives in the API layer for
-- easier rollout (there are still legacy orphans in prod that have none of the
-- three set; they'll be fixed on the /orfani triage page).

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assigned_section_id    UUID REFERENCES sections(id)    ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_section_id    ON tasks(assigned_section_id)    WHERE assigned_section_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_department_id ON tasks(assigned_department_id) WHERE assigned_department_id IS NOT NULL;
