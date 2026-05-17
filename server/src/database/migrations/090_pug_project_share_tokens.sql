-- Migration 090: Public read-only share tokens for PUG projects.
--
-- David needs to send the polgármesteri hivatal a project status link.
-- Today there is no way — every endpoint is auth-only, and inviting the
-- mayor's office as a user is overkill.
--
-- A share token is a random opaque string that, when presented in a URL,
-- grants READ-ONLY access to a specific project's status (stages, deadlines,
-- meta — never financials or attachments). Same pattern as magic_links
-- (migration 078) but project-scoped and not single-use.

CREATE TABLE IF NOT EXISTS pug_project_share_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES pug_projects(id) ON DELETE CASCADE,
    token           TEXT UNIQUE NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    expires_at      TIMESTAMPTZ,            -- null = never expires; UI can revoke instead
    revoked_at      TIMESTAMPTZ,
    last_viewed_at  TIMESTAMPTZ,
    view_count      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pug_share_tokens_token   ON pug_project_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pug_share_tokens_project ON pug_project_share_tokens(project_id);
