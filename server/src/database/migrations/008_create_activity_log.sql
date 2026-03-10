-- Migration 008: Create activity_log table
CREATE TYPE action_type AS ENUM (
  'created', 'status_changed', 'due_date_changed', 'comment_added',
  'subtask_added', 'subtask_completed', 'subtask_assigned',
  'attachment_added', 'label_changed', 'recurring_created'
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type action_type NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_task ON activity_log(task_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);
