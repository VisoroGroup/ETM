-- Migration 043: Merge duplicate Emőke user accounts
-- "Ledényi Emőke" (ledenyi.emoke@visoro-global.ro) → "Emőke Ledényi" (Emoke.ledenyi@visoro-global.ro)
-- All references are moved to the primary account, then the duplicate is deactivated.

DO $$
DECLARE
    v_primary_id UUID;
    v_duplicate_id UUID;
BEGIN
    -- Find primary (the one with avatar / admin role)
    SELECT id INTO v_primary_id FROM users WHERE LOWER(email) = LOWER('Emoke.ledenyi@visoro-global.ro') AND is_active = true LIMIT 1;
    -- Find duplicate
    SELECT id INTO v_duplicate_id FROM users WHERE LOWER(email) = LOWER('ledenyi.emoke@visoro-global.ro') AND is_active = true LIMIT 1;

    -- If either doesn't exist, skip
    IF v_primary_id IS NULL OR v_duplicate_id IS NULL THEN
        RAISE NOTICE 'One or both users not found, skipping merge.';
        RETURN;
    END IF;

    IF v_primary_id = v_duplicate_id THEN
        RAISE NOTICE 'Same user, skipping.';
        RETURN;
    END IF;

    RAISE NOTICE 'Merging user % into %', v_duplicate_id, v_primary_id;

    -- Tasks: created_by, assigned_to
    UPDATE tasks SET created_by = v_primary_id WHERE created_by = v_duplicate_id;
    UPDATE tasks SET assigned_to = v_primary_id WHERE assigned_to = v_duplicate_id;

    -- Subtasks: assigned_to
    UPDATE subtasks SET assigned_to = v_primary_id WHERE assigned_to = v_duplicate_id;

    -- Task comments: author_id
    UPDATE task_comments SET author_id = v_primary_id WHERE author_id = v_duplicate_id;

    -- Activity log: user_id
    UPDATE activity_log SET user_id = v_primary_id WHERE user_id = v_duplicate_id;

    -- Task status changes: changed_by
    UPDATE task_status_changes SET changed_by = v_primary_id WHERE changed_by = v_duplicate_id;

    -- Task due date changes: changed_by
    UPDATE task_due_date_changes SET changed_by = v_primary_id WHERE changed_by = v_duplicate_id;

    -- Notifications: user_id, created_by
    UPDATE notifications SET user_id = v_primary_id WHERE user_id = v_duplicate_id;
    UPDATE notifications SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Task alerts: created_by, resolved_by
    UPDATE task_alerts SET created_by = v_primary_id WHERE created_by = v_duplicate_id;
    UPDATE task_alerts SET resolved_by = v_primary_id WHERE resolved_by = v_duplicate_id;

    -- Email logs: user_id
    UPDATE email_logs SET user_id = v_primary_id WHERE user_id = v_duplicate_id;

    -- Recurring tasks: created_by
    UPDATE recurring_tasks SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Task checklists: created_by
    UPDATE task_checklists SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Task dependencies: created_by
    UPDATE task_dependencies SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Comment reactions: user_id (handle unique constraint)
    UPDATE comment_reactions SET user_id = v_primary_id WHERE user_id = v_duplicate_id
        AND NOT EXISTS (SELECT 1 FROM comment_reactions cr2 WHERE cr2.comment_id = comment_reactions.comment_id AND cr2.user_id = v_primary_id AND cr2.reaction = comment_reactions.reaction);
    DELETE FROM comment_reactions WHERE user_id = v_duplicate_id;

    -- Saved filters: user_id
    UPDATE saved_filters SET user_id = v_primary_id WHERE user_id = v_duplicate_id;

    -- Dashboard preferences: user_id (handle unique constraint)
    DELETE FROM dashboard_preferences WHERE user_id = v_duplicate_id;

    -- Payments: created_by, paid_by
    UPDATE payments SET created_by = v_primary_id WHERE created_by = v_duplicate_id;
    UPDATE payments SET paid_by = v_primary_id WHERE paid_by = v_duplicate_id;

    -- Payment comments: author_id
    UPDATE payment_comments SET author_id = v_primary_id WHERE author_id = v_duplicate_id;

    -- Payment activity log: user_id
    UPDATE payment_activity_log SET user_id = v_primary_id WHERE user_id = v_duplicate_id;

    -- Budget entries: updated_by
    UPDATE budget_entries SET updated_by = v_primary_id WHERE updated_by = v_duplicate_id;

    -- Cash balance: updated_by
    UPDATE cash_balance SET updated_by = v_primary_id WHERE updated_by = v_duplicate_id;

    -- Client invoices: created_by
    UPDATE client_invoices SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Outstanding items: created_by
    -- (table may have been dropped by migration 040, so wrap in exception handler)
    BEGIN
        UPDATE outstanding_items SET created_by = v_primary_id WHERE created_by = v_duplicate_id;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    -- Bank imports: imported_by
    UPDATE bank_statement_imports SET imported_by = v_primary_id WHERE imported_by = v_duplicate_id;

    -- Bank statement rows: approved_by
    UPDATE bank_statement_rows SET approved_by = v_primary_id WHERE approved_by = v_duplicate_id;

    -- API tokens: created_by
    UPDATE api_tokens SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Webhooks: created_by
    UPDATE webhooks SET created_by = v_primary_id WHERE created_by = v_duplicate_id;

    -- Deactivate the duplicate user
    UPDATE users SET is_active = false, updated_at = NOW() WHERE id = v_duplicate_id;

    RAISE NOTICE 'Merge complete. Duplicate user % deactivated.', v_duplicate_id;
END $$;
