-- Migration 079: Per-company settings (audit-3 C7 fix)
--
-- The `settings` table was created in migration 058 as a single global
-- key/value store. With multi-tenancy (added in migration 070+), the
-- `company_main_goal` key is per-company — every company has its own
-- "what we're working towards" banner. The current global table means a
-- superadmin editing Visoro Global's goal overwrites Hungary's and Neo
-- Plan's, and all three companies see the same banner.
--
-- Fix:
--   1) Add company_id (NOT NULL after backfill; default Visoro Global = 1).
--   2) Drop the unique index on (key) and replace with (company_id, key).
--   3) The existing single row keeps its content for Visoro Global; the
--      other companies will see an empty banner until their superadmin
--      sets one.

DO $$
DECLARE
    has_company_col BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'settings' AND column_name = 'company_id'
    ) INTO has_company_col;

    IF NOT has_company_col THEN
        -- Add the column with DEFAULT 1 so existing rows backfill to Visoro Global.
        ALTER TABLE settings ADD COLUMN company_id INTEGER DEFAULT 1;
        UPDATE settings SET company_id = 1 WHERE company_id IS NULL;
        ALTER TABLE settings ALTER COLUMN company_id SET NOT NULL;

        -- FK to companies (skip if missing — defensive against test installs
        -- that may not have run migration 070 yet).
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
            ALTER TABLE settings
                ADD CONSTRAINT fk_settings_company_id
                FOREIGN KEY (company_id) REFERENCES companies(id);
        END IF;
    END IF;
END
$$;

-- Drop the old global UNIQUE on (key) — superseded by the per-tenant one.
DROP INDEX IF EXISTS idx_settings_key;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

-- One row per (company, key).
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_company_key
    ON settings(company_id, key);
