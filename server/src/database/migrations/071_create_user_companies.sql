-- Migration 071: Create user_companies junction table.
--
-- Users are NOT scoped to a single company — they can be members of any
-- number of companies. This composite-key table lists which companies each
-- user has access to. Auth middleware reads this on every request to
-- compute `req.userCompanyIds`.
--
-- For backfill, every existing user is granted access to Visoro Global
-- (companies.id = 1). Superadmin/admin users (Mia/Emo) effectively get
-- access to ALL companies — that fan-out is computed in the middleware,
-- not stored here, so there's no need to insert a row per company per
-- admin.

CREATE TABLE IF NOT EXISTS user_companies (
    user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user_id    ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id);

-- Backfill: every existing user gets access to Visoro Global (id=1).
-- ON CONFLICT keeps this safe to re-run.
INSERT INTO user_companies (user_id, company_id)
SELECT id, 1 FROM users
ON CONFLICT (user_id, company_id) DO NOTHING;
