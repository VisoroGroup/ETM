-- Migration 045: Retry merge of duplicate Emőke user (043 failed due to PL/pgSQL split)
-- Uses subqueries instead of DO block to be compatible with the statement-based migration runner

UPDATE tasks SET created_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE created_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1) AND (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1) IS NOT NULL;

UPDATE tasks SET assigned_to = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE assigned_to = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1) AND (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1) IS NOT NULL;

UPDATE subtasks SET assigned_to = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE assigned_to = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE task_comments SET author_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE author_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE activity_log SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE task_status_changes SET changed_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE changed_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE task_due_date_changes SET changed_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE changed_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE notifications SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE notifications SET created_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE created_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE task_alerts SET created_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE created_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE task_alerts SET resolved_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE resolved_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE email_logs SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE recurring_tasks SET created_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE created_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE saved_filters SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE payments SET created_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE created_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE payments SET paid_by = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE paid_by = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE payment_comments SET author_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE author_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE payment_activity_log SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true LIMIT 1) WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

DELETE FROM dashboard_preferences WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

DELETE FROM comment_reactions WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

DELETE FROM user_preferences WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' LIMIT 1);

UPDATE users SET is_active = false, updated_at = NOW() WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true;
