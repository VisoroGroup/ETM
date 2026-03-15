-- Migration 014: Task templates table

CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department_label VARCHAR(100) NOT NULL DEFAULT 'departament_1',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    subtasks JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_created_by ON task_templates(created_by);
