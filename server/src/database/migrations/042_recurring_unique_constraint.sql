-- Migration 042: Add unique constraint on recurring_tasks.template_task_id
-- Prevents duplicate recurring entries for the same task (race condition fix)

-- Remove any existing duplicates first (keep the most recent one)
DELETE FROM recurring_tasks a
USING recurring_tasks b
WHERE a.template_task_id = b.template_task_id
  AND a.updated_at < b.updated_at;

ALTER TABLE recurring_tasks ADD CONSTRAINT uq_recurring_task_template UNIQUE (template_task_id);
