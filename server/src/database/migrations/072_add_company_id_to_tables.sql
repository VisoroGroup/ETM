-- Migration 072: Add `company_id` to every tenant-scoped data table.
--
-- Until migration 070 the app was single-tenant (Visoro Global). This
-- migration retrofits the existing tables with a `company_id` foreign key
-- so every row knows which company it belongs to.
--
-- Backfill strategy: every existing row is assigned to Visoro Global
-- (companies.id = 1). The column is added with DEFAULT 1 so the backfill
-- is automatic, then the DEFAULT is dropped so future inserts must be
-- explicit about which company they belong to.
--
-- Tables NOT touched (intentionally):
--   - users               (multi-tenant via the user_companies junction)
--   - api_tokens          (scoped to user, not company)
--   - settings            (app-global config)
--   - user_preferences    (per-user)
--   - saved_filters       (per-user)
--   - dashboard_preferences (per-user)
--
-- All FK references companies(id). All columns are NOT NULL after backfill.
-- Each table also gets an index on company_id for fast filtering.

DO $$
DECLARE
    t TEXT;
    tenant_tables TEXT[] := ARRAY[
        'tasks',
        'subtasks',
        'task_comments',
        'task_attachments',
        'task_status_changes',
        'task_due_date_changes',
        'task_alerts',
        'task_checklist_items',
        'task_dependencies',
        'comment_reactions',
        'task_templates',
        'recurring_tasks',
        'posts',
        'departments',
        'sections',
        'policies',
        'policy_departments',
        'policy_posts',
        'notifications',
        'email_logs',
        'activity_log',
        'webhook_deliveries',
        'webhook_subscriptions'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables
    LOOP
        -- Only act if the table actually exists (defensive — some envs may
        -- have skipped optional tables).
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN

            -- 1) Add the column with DEFAULT 1 so existing rows are
            --    automatically tagged as Visoro Global.
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id INTEGER DEFAULT 1',
                t
            );

            -- 2) Backfill any rows that somehow ended up NULL (no-op if the
            --    DEFAULT already filled them).
            EXECUTE format(
                'UPDATE %I SET company_id = 1 WHERE company_id IS NULL',
                t
            );

            -- 3) Add the foreign key (skipped if already present).
            EXECUTE format($f$
                DO $inner$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE table_name = %L
                          AND constraint_name = %L
                    ) THEN
                        ALTER TABLE %I
                            ADD CONSTRAINT %I
                            FOREIGN KEY (company_id) REFERENCES companies(id);
                    END IF;
                END
                $inner$;
            $f$, t, 'fk_' || t || '_company_id', t, 'fk_' || t || '_company_id');

            -- 4) NOT NULL only. We KEEP the DEFAULT 1 on purpose so that
            --    INSERTs from existing routes (which are not yet company-aware)
            --    continue to work and silently land in Visoro Global. Once
            --    every route is updated to specify company_id explicitly we
            --    can drop the default in a follow-up migration.
            EXECUTE format('ALTER TABLE %I ALTER COLUMN company_id SET NOT NULL', t);

            -- 5) Index for fast tenant-scoped lookups.
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I(company_id)',
                'idx_' || t || '_company_id', t
            );
        END IF;
    END LOOP;
END
$$;
