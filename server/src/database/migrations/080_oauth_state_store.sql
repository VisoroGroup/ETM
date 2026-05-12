-- Migration 080: Persist OAuth state + one-time auth codes in the DB
-- (audit-3 C17 fix).
--
-- The in-memory `oauthStateStore` and `authCodeStore` Maps live inside the
-- Node process. On Railway with >1 replica, the OAuth callback may land on
-- replica A (writes state) while the exchange request lands on replica B
-- (state not found). Result: OAuth randomly fails for ~50% of attempts.
--
-- DB-backed storage is multi-replica safe; rows are short-lived (5min state,
-- 60s auth code) and we delete them on first use.

CREATE TABLE IF NOT EXISTS oauth_states (
    state        VARCHAR(128) PRIMARY KEY,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS auth_codes (
    code         VARCHAR(64) PRIMARY KEY,
    token        TEXT NOT NULL,        -- The issued JWT (one-time use)
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_expires_at ON auth_codes(expires_at);
