-- Migration 077: Hot-path indexes flagged in the second audit (DB indexes section).
--
-- All CREATE INDEX statements are IF NOT EXISTS so the migration is safe to
-- re-run, and CONCURRENTLY is intentionally NOT used so it can run inside
-- the migration transaction (these tables are small enough that a brief lock
-- on boot is acceptable).
--
-- Composite + partial indexes are picked to match the actual WHERE clauses
-- used by the hottest endpoints (task list, dashboard, my-stats, calendar).

-- Foreign-key indexes (cascading deletes / who-changed-what scans were seqscan).
CREATE INDEX IF NOT EXISTS idx_task_status_changes_changed_by ON task_status_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_task_due_date_changes_changed_by ON task_due_date_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_pug_projects_work_type_id ON pug_projects(work_type_id);
CREATE INDEX IF NOT EXISTS idx_pug_project_stages_stage_catalog_id ON pug_project_stages(stage_catalog_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_created_by ON webhook_subscriptions(created_by);

-- policies: created_by_id may not exist on every install — guard with DO block.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'policies' AND column_name = 'created_by_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_policies_created_by_id ON policies(created_by_id)';
    END IF;
END
$$;

-- departments / sections head_user_id (for "is this user a head" lookups)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'departments' AND column_name = 'head_user_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_departments_head_user_id ON departments(head_user_id)';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'sections' AND column_name = 'head_user_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sections_head_user_id ON sections(head_user_id)';
    END IF;
END
$$;

-- Composite indexes for the most common query shapes:
-- 1. Task list filtered by company + active (deleted_at IS NULL) + status.
CREATE INDEX IF NOT EXISTS idx_tasks_company_status_active
    ON tasks(company_id, status)
    WHERE deleted_at IS NULL;

-- 2. Calendar / due-date views: company-scoped, ordered by due_date.
CREATE INDEX IF NOT EXISTS idx_tasks_company_due_date
    ON tasks(company_id, due_date)
    WHERE deleted_at IS NULL;

-- 3. Notification bell unread count + list (per user, per company, newest first).
CREATE INDEX IF NOT EXISTS idx_notifications_user_company_created
    ON notifications(user_id, company_id, created_at DESC);

-- 4. Recurring engine — find active templates for a given task.
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_template_active
    ON recurring_tasks(template_task_id)
    WHERE is_active = true;

-- Trigram index for global search (tasks.title, task_comments.content).
-- Requires the `pg_trgm` extension; install if missing. unaccent already
-- enabled by migration 067.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm
    ON tasks USING gin (title gin_trgm_ops)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_comments_content_trgm
    ON task_comments USING gin (content gin_trgm_ops);
