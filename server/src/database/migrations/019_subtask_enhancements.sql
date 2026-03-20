-- Add due_date and priority to subtasks
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';

-- Validate priority values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subtasks_priority_check'
  ) THEN
    ALTER TABLE subtasks ADD CONSTRAINT subtasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;
