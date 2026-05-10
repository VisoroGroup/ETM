-- Migration 074: PUG stage reminder log
-- Tracks which (project_stage_id, level) reminder rows have already been sent
-- so the daily cron does not re-fire the same reminder. Levels are:
--   'd14' | 'd7' | 'd3' | 'd1' | 'd0' | 'overdue'

CREATE TABLE IF NOT EXISTS pug_stage_reminder_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_stage_id UUID NOT NULL REFERENCES pug_project_stages(id) ON DELETE CASCADE,
    level           TEXT NOT NULL,  -- 'd14' | 'd7' | 'd3' | 'd1' | 'd0' | 'overdue'
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_stage_id, level)
);
CREATE INDEX IF NOT EXISTS idx_pug_stage_rem_log_stage ON pug_stage_reminder_log(project_stage_id);
CREATE INDEX IF NOT EXISTS idx_pug_stage_rem_log_company ON pug_stage_reminder_log(company_id);
