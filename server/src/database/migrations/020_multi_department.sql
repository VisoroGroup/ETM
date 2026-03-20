-- Migration: Convert single department to multi-department (TEXT array)
-- This allows users to belong to multiple departments

-- Step 1: Add new departments column as TEXT array
ALTER TABLE users ADD COLUMN IF NOT EXISTS departments TEXT[] DEFAULT '{}';

-- Step 2: Copy existing department values into the new array column
UPDATE users SET departments = ARRAY[department::TEXT] WHERE department IS NOT NULL AND departments = '{}';

-- Step 3: Drop the old single-value column
ALTER TABLE users DROP COLUMN IF EXISTS department;

-- Step 4: Rename for clarity (optional, keep as 'departments')
-- The column is now 'departments' TEXT[]
