-- Migration 050: Fix Emőke email — final attempt
--
-- Problem: deactivated user still holds the email ledenyi.emoke@visoro-global.ro
-- so the active admin account can't be updated to it (unique constraint).
--
-- Step 1: Rename the deactivated user's email to free up the address
-- Step 2: Update the active admin account email to match SSO

-- Step 1: free up the email on all deactivated emoke users
UPDATE users
SET email = email || '.DEACTIVATED',
    updated_at = NOW()
WHERE is_active = false
  AND LOWER(email) = 'ledenyi.emoke@visoro-global.ro';

-- Step 2: update the active admin account to the SSO email
UPDATE users
SET email = 'ledenyi.emoke@visoro-global.ro',
    updated_at = NOW()
WHERE id = '12c31954-6e1e-476d-a077-4e3dc635bef6';
