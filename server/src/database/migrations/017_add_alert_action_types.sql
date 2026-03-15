-- Migration 017: Add alert_added and alert_resolved to action_type enum
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'alert_added';
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'alert_resolved';
