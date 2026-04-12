-- Migration 057: Add assigned_post_id to tasks table
-- In the new system, tasks are assigned to posts (not directly to users)
-- The assigned_to column stays for backward compatibility during transition
-- The post's current user_id determines who gets notifications

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_assigned_post_id ON tasks(assigned_post_id);
