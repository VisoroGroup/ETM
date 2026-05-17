-- Migration 085: Comments and attachments on subtasks.
--
-- Hungary uses subtasks as the actual unit of work — the parent task is just
-- an umbrella and each subtask is what someone actually does. Today
-- subtasks support only title + completed + assignee + due_date + priority.
-- Comments and files have to be attached to the umbrella task, which mixes
-- conversations across unrelated subtasks.
--
-- Mirrors task_comments / task_attachments. company_id is denormalized for
-- multi-tenant guards; ON DELETE CASCADE on subtask_id so cleanup is free.

CREATE TABLE IF NOT EXISTS subtask_comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subtask_id  UUID NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    mentions    UUID[] DEFAULT '{}',
    company_id  INTEGER NOT NULL REFERENCES companies(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtask_comments_subtask ON subtask_comments(subtask_id);
CREATE INDEX IF NOT EXISTS idx_subtask_comments_author  ON subtask_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_subtask_comments_company ON subtask_comments(company_id);

CREATE TABLE IF NOT EXISTS subtask_attachments (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subtask_id    UUID NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    file_name     VARCHAR(500) NOT NULL,
    file_url      TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    uploaded_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id    INTEGER NOT NULL REFERENCES companies(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtask_attachments_subtask ON subtask_attachments(subtask_id);
CREATE INDEX IF NOT EXISTS idx_subtask_attachments_company ON subtask_attachments(company_id);
