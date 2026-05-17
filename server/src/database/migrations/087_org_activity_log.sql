-- Migration 087: Activity log for org-structure events.
--
-- task-scoped activity_log can't capture "Emőke moved Facturare to Andrei"
-- or "Robert uploaded a new Directivă" — those have no task_id. Today such
-- changes happen silently: a user reassignment, a policy upload, a new
-- post — none of it is recorded anywhere.
--
-- A separate org_activity_log table keeps the task-scoped log clean and
-- gives Visoro Global an audit trail for org-structure changes.

CREATE TABLE IF NOT EXISTS org_activity_log (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type  TEXT NOT NULL,           -- 'post_created' | 'post_user_changed' | 'post_deleted'
                                          -- 'section_created' | 'section_deleted'
                                          -- 'department_created' | 'department_deleted'
                                          -- 'policy_uploaded' | 'policy_attached' | 'policy_detached' | 'policy_deleted'
    target_type  TEXT NOT NULL,           -- 'post' | 'section' | 'department' | 'policy'
    target_id    UUID,                    -- the affected row's id, null for deletes after the fact
    details      JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_activity_log_company_created
    ON org_activity_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_activity_log_target
    ON org_activity_log(target_type, target_id);
