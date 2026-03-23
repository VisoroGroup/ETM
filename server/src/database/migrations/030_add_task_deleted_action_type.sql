-- Migration 030: Add task_deleted to action_type enum
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'task_deleted';
