-- Migration 047: Final fix for Emőke's duplicate user accounts
--
-- Current state (after auth callback reactivated the SSO user):
--   User A: emoke.ledenyi@visoro-global.ro, is_active=true, microsoft_id='pending-...'
--   User B: ledenyi.emoke@visoro-global.ro, is_active=true, microsoft_id=real SSO id
--
-- Emőke is currently logged in as User B (the one with the real microsoft_id).
-- We keep User B as the primary, transfer all references from User A, then deactivate User A.
--
-- This migration is idempotent — safe to re-run if only one user remains active.

-- Step 1: Deactivate User A (the pending- one) and rename to avoid conflicts.
-- First, move all references from A → B.

-- Tasks: created_by
UPDATE tasks SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
) AND (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1) IS NOT NULL;

-- Tasks: assigned_to
UPDATE tasks SET assigned_to = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE assigned_to IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
) AND (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1) IS NOT NULL;

-- Subtasks: assigned_to
UPDATE subtasks SET assigned_to = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE assigned_to IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Task comments: author_id
UPDATE task_comments SET author_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE author_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Activity log: user_id
UPDATE activity_log SET user_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Task status changes: changed_by
UPDATE task_status_changes SET changed_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE changed_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Task due date changes: changed_by
UPDATE task_due_date_changes SET changed_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE changed_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Notifications: user_id, created_by
UPDATE notifications SET user_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

UPDATE notifications SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Task alerts: created_by, resolved_by
UPDATE task_alerts SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

UPDATE task_alerts SET resolved_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE resolved_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Email logs: user_id
UPDATE email_logs SET user_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Recurring tasks: created_by
UPDATE recurring_tasks SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Saved filters: user_id
UPDATE saved_filters SET user_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Dashboard preferences
DELETE FROM dashboard_preferences WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Comment reactions
DELETE FROM comment_reactions WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- User preferences
DELETE FROM user_preferences WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Payments: created_by, paid_by
UPDATE payments SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

UPDATE payments SET paid_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE paid_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Payment comments: author_id
UPDATE payment_comments SET author_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE author_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Payment activity log: user_id
UPDATE payment_activity_log SET user_id = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE user_id IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Budget entries: updated_by
UPDATE budget_entries SET updated_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE updated_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Cash balance: updated_by
UPDATE cash_balance SET updated_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE updated_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Client invoices: created_by
UPDATE client_invoices SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Bank imports: imported_by
UPDATE bank_statement_imports SET imported_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE imported_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Bank statement rows: approved_by
UPDATE bank_statement_rows SET approved_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE approved_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- API tokens: created_by
UPDATE api_tokens SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Webhooks: created_by
UPDATE webhooks SET created_by = (
    SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1
) WHERE created_by IN (
    SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND microsoft_id LIKE 'pending-%'
);

-- Step 2: Deactivate and rename User A (the pending- one)
UPDATE users
SET is_active = false,
    email = 'emoke.ledenyi.DEACTIVATED@visoro-global.ro',
    microsoft_id = 'DEACTIVATED-' || microsoft_id,
    updated_at = NOW()
WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro'
  AND microsoft_id LIKE 'pending-%';
