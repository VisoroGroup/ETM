-- Migration 086: org-aware task templates.
--
-- Until now task_templates carried only a raw `assigned_to` user UUID. That
-- meant a recurring "Factură lunară" template, instantiated from the Visoro
-- Global tenant, kept firing tasks at a specific user even after that user
-- left the post. Tasks created from templates entirely bypassed the
-- department/section/post org-routing layer.
--
-- Adding the three optional scope columns mirrors how `tasks` itself stores
-- the assignment scope (tasks.assigned_post_id / _section_id / _department_id).
-- The createTask service then auto-resolves the actual user from the scope at
-- instantiation time — which means the template follows the *role*, not the
-- person.

ALTER TABLE task_templates
    ADD COLUMN IF NOT EXISTS assigned_post_id UUID,
    ADD COLUMN IF NOT EXISTS assigned_section_id UUID,
    ADD COLUMN IF NOT EXISTS assigned_department_id UUID;
