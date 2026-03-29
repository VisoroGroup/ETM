-- Migration 037: Add ALL missing action_type enum values
-- These are used by the codebase but were never added to the enum.
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'checklist_updated';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'description_changed';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'task_deleted';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'dependency_added';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'dependency_removed';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'dependency_resolved';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'alert_added';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'alert_resolved';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'title_changed';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'assigned_to_changed';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'department_changed';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'task_created';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'task_duplicated';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'attachment_read';
