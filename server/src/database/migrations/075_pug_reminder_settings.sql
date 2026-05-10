-- Migration 075: PUG reminder settings (per-company configurable reminder levels)
--
-- Replaces the previously hardcoded reminder cadence (14d, 7d, 3d, 1d, 0d, overdue)
-- with per-company configurable rows. The cron loads enabled rows for each
-- project-template company and fires reminders accordingly.
--
-- days_before semantics:
--   > 0 : N days BEFORE the deadline (e.g. 14 = "two weeks before")
--   = 0 : ON the deadline day
--   < 0 : N days AFTER the deadline (e.g. -1 = "one day past deadline" / overdue)

CREATE TABLE IF NOT EXISTS pug_reminder_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    days_before INTEGER NOT NULL,
    is_enabled  BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, days_before)
);

CREATE INDEX IF NOT EXISTS idx_pug_reminder_settings_company ON pug_reminder_settings(company_id);

-- Backward compatibility: seed the existing hardcoded set for every project-template company.
-- Levels mirror the previous cron behavior: 14, 7, 3, 1, 0, -1 (overdue, +1 day past deadline).
INSERT INTO pug_reminder_settings (company_id, days_before, is_enabled)
SELECT c.id, v.days_before, true
FROM companies c
CROSS JOIN (VALUES (14), (7), (3), (1), (0), (-1)) AS v(days_before)
WHERE c.template_type = 'project'
ON CONFLICT (company_id, days_before) DO NOTHING;
