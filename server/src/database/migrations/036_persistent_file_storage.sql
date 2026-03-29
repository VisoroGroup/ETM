-- Migration 036: Store uploaded files in PostgreSQL for persistence across deploys
-- Railway ephemeral filesystem loses files on redeploy. DB storage is persistent.

-- Avatar binary data stored directly in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime VARCHAR(50);

-- Attachment binary data stored in task_attachments table
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100);
