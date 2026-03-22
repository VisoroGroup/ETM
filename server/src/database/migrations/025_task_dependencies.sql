-- Task Dependencies: formal blocking relationships between tasks
CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocking_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    blocked_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Cannot block yourself
    CONSTRAINT no_self_dependency CHECK (blocking_task_id != blocked_task_id),
    -- One pair only once
    CONSTRAINT unique_dependency UNIQUE (blocking_task_id, blocked_task_id)
);

CREATE INDEX idx_task_deps_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX idx_task_deps_blocked ON task_dependencies(blocked_task_id);
