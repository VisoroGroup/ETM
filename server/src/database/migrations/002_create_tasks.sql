-- Migration 002: Create tasks table
CREATE TYPE task_status AS ENUM ('de_rezolvat', 'in_realizare', 'terminat', 'blocat');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'de_rezolvat',
  due_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_label department_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_department_label ON tasks(department_label);
CREATE INDEX idx_tasks_due_date_status ON tasks(due_date, status);
