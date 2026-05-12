-- Migration 081: add updated_at to webhook_deliveries (hotfix for audit-3 C16)
--
-- The retry processor's watchdog (services/webhookService.ts) updates
-- `updated_at` to detect rows stuck in `status='sending'` for >5 minutes.
-- Migration 028 only declared `created_at` on this table, so every retry
-- tick fails with `column "updated_at" does not exist`, spamming logs and
-- (more importantly) preventing the watchdog from recovering stuck rows.
--
-- This migration:
--   1) adds the column (backfilled from created_at so legacy rows have a value)
--   2) creates a BEFORE UPDATE trigger that bumps updated_at automatically,
--      matching the convention used by every other tenant-scoped table.

ALTER TABLE webhook_deliveries
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill so existing rows have a sensible value (NOW() default only
-- applies to NEW rows; old rows get their created_at).
UPDATE webhook_deliveries SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = NOW();

-- Auto-bump on every UPDATE. Reuses a generic trigger function if present;
-- otherwise creates one. (Several other migrations also rely on this
-- pattern, but each one rolls its own trigger fn — we declare a private
-- one here to avoid stomping on existing trigger function names.)
CREATE OR REPLACE FUNCTION webhook_deliveries_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_deliveries_updated_at ON webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_updated_at
    BEFORE UPDATE ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION webhook_deliveries_set_updated_at();
