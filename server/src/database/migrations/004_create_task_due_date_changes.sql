-- Migration 004: Create task_due_date_changes table
CREATE TABLE task_due_date_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  old_date DATE NOT NULL,
  new_date DATE NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_due_date_changes_task ON task_due_date_changes(task_id);
