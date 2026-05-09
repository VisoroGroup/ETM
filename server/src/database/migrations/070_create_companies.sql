-- Migration 070: Create companies table for multi-tenant support.
--
-- Until now the ETM app has served a single company ("Visoro Global SRL").
-- This migration introduces the `companies` table as the foundation for
-- multi-tenant separation. Future companies (Visoro Neo Plan, Visoro Hungary
-- KFT, etc.) will be inserted as additional rows.
--
-- The first row MUST end up with id=1 — every existing tenant-scoped table
-- in migration 072 backfills `company_id = 1` to belong to Visoro Global.
--
-- Notes:
--   - id is SERIAL (INTEGER) on purpose; the rest of the schema uses UUIDs
--     but companies are an app-global registry referenced from many tables,
--     so a small integer is friendlier for headers, joins, and indexes.
--   - sidebar_name is the short form shown in the company switcher in the UI.
--   - template_type controls which task layout/template a company uses.

CREATE TABLE IF NOT EXISTS companies (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,                          -- full official name e.g. "Visoro Global SRL"
    sidebar_name    TEXT NOT NULL,                          -- short form for the sidebar e.g. "Global"
    slug            TEXT UNIQUE NOT NULL,                   -- url-safe slug e.g. "global", "neoplan", "hungary"
    language        TEXT NOT NULL DEFAULT 'ro',             -- 'ro' | 'hu' | 'en'
    template_type   TEXT NOT NULL DEFAULT 'simple',         -- 'full' | 'project' | 'simple'
    color           TEXT NOT NULL DEFAULT '#F59E0B',        -- hex color for company-themed UI
    icon            TEXT,                                   -- lucide icon name (optional)
    sort_order      INTEGER NOT NULL DEFAULT 999,
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug        ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_sort_order  ON companies(sort_order);
CREATE INDEX IF NOT EXISTS idx_companies_is_archived ON companies(is_archived);

-- Seed Visoro Global as id=1. The SERIAL sequence starts at 1, so this row
-- becomes id=1 and the FK default of `1` in migration 072 is valid.
INSERT INTO companies (name, sidebar_name, slug, language, template_type, color, sort_order)
SELECT 'Visoro Global SRL', 'Visoro Global', 'global', 'ro', 'full', '#F59E0B', 1
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE slug = 'global');
