-- Add working days only option for daily recurring tasks
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS workdays_only BOOLEAN DEFAULT false;
