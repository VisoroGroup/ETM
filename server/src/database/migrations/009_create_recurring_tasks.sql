-- Migration 009: Create recurring_tasks table
CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

CREATE TABLE recurring_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  frequency recurring_frequency NOT NULL,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_tasks_template ON recurring_tasks(template_task_id);
CREATE INDEX idx_recurring_tasks_next_run ON recurring_tasks(next_run_date);
CREATE INDEX idx_recurring_tasks_active ON recurring_tasks(is_active);
