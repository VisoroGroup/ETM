-- Migration 034: Add checklist_updated to action_type enum
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'checklist_updated';
