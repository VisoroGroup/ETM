-- Migration 029: Performance indexes for frequently-used query patterns

-- Index on tasks.assigned_to — used in task list filtering, dashboard scoping, and user scope queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- Composite index for non-deleted active tasks (most common dashboard query pattern)
CREATE INDEX IF NOT EXISTS idx_tasks_active_not_deleted ON tasks(status, deleted_at) WHERE deleted_at IS NULL;

-- Index on subtasks.assigned_to — used in user scope filter subqueries
CREATE INDEX IF NOT EXISTS idx_subtasks_assigned_to ON subtasks(assigned_to) WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

-- Index on task_alerts for unresolved alerts (dashboard active-alerts widget)
CREATE INDEX IF NOT EXISTS idx_task_alerts_unresolved ON task_alerts(task_id, is_resolved) WHERE is_resolved = false;

-- Index on activity_log.task_id for faster activity loading
CREATE INDEX IF NOT EXISTS idx_activity_log_task_id ON activity_log(task_id, created_at DESC);

-- Index on task_dependencies for faster dependency chain lookups
CREATE INDEX IF NOT EXISTS idx_task_deps_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_blocked ON task_dependencies(blocked_task_id);

-- Index on payments for common filters
CREATE INDEX IF NOT EXISTS idx_payments_status_deleted ON payments(status, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date) WHERE deleted_at IS NULL;
