-- Migration 003: Create task_status_changes table
CREATE TABLE task_status_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  old_status task_status NOT NULL,
  new_status task_status NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_status_changes_task ON task_status_changes(task_id);
