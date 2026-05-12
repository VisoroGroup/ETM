-- Migration 078: Magic-link login tokens
--
-- Adds a second login path for external collaborators (gmail/yahoo/etc.) who
-- don't have Microsoft 365 accounts. Flow:
--   1. Visitor enters their email on the login screen and clicks "send link".
--   2. Server hashes a random token, stores it here with a short expiry, and
--      emails the raw token to the address (only if an active user with that
--      email exists — but always responds 200 to avoid enumeration leaks).
--   3. Visitor clicks the link → /auth/magic-link?token=... → server hashes
--      the incoming token, looks up an UNUSED row whose hash matches and
--      whose expires_at > NOW(), marks it used, issues a 30-day JWT.
--
-- We store ONLY the hash so a DB leak doesn't let an attacker reuse pending
-- tokens (same approach as api_tokens). expires_at is short (15 minutes) so
-- intercepted links can't be replayed hours later.

CREATE TABLE IF NOT EXISTS magic_links (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Hashed token (SHA-256 hex). Never store raw tokens.
    token_hash   VARCHAR(128) NOT NULL UNIQUE,
    -- Lowercased email this link was issued for. We resolve user_id at verify
    -- time (not at request time) so we can keep emitting links even before an
    -- admin has provisioned the user — but verify still requires an active
    -- account, so unprovisioned emails can request all day with no effect.
    email        TEXT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ NULL,
    requested_ip TEXT NULL,
    user_agent   TEXT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup at verify time.
CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash);

-- Rate-limit / audit queries by (email, created_at).
CREATE INDEX IF NOT EXISTS idx_magic_links_email_created ON magic_links(LOWER(email), created_at DESC);

-- Periodic cleanup target: a future cron deletes rows where created_at is
-- old enough that they're guaranteed expired-or-used. Index on created_at
-- alone (NOW() can't appear in a partial-index predicate — not immutable).
CREATE INDEX IF NOT EXISTS idx_magic_links_created_at ON magic_links(created_at);
