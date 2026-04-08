-- Migration 047: Final fix for Emőke's login — clean up deactivated duplicate
--
-- Problem: Migration 045 deactivated the user with email ledenyi.emoke@visoro-global.ro
-- (which had the REAL microsoft_id from actual SSO login).
-- Migration 046 tried to rename the primary user's email to ledenyi.emoke@visoro-global.ro
-- but likely FAILED due to UNIQUE constraint (deactivated user still has that email).
--
-- Result: Emőke can't log in because:
--   1. Microsoft sends email ledenyi.emoke@visoro-global.ro
--   2. Auth callback finds the DEACTIVATED user (is_active=false) with that email
--   3. That user has the real microsoft_id, so upsert matches it
--   4. Token is generated for inactive user → auth middleware rejects
--
-- Fix: Transfer the real microsoft_id from the deactivated user to the active one,
-- clear the deactivated user's email to remove the UNIQUE conflict,
-- then update the active user's email to the correct SSO email.

-- Step 1: Copy the real microsoft_id from deactivated user to active user
-- (The active user has email emoke.ledenyi@visoro-global.ro or a pending- microsoft_id)
UPDATE users
SET microsoft_id = (
    SELECT microsoft_id FROM users
    WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
      AND is_active = false
      AND microsoft_id NOT LIKE 'pending-%'
    LIMIT 1
),
updated_at = NOW()
WHERE (LOWER(email) = 'emoke.ledenyi@visoro-global.ro' OR LOWER(email) = 'ledenyi.emoke@visoro-global.ro')
  AND is_active = true
  AND (SELECT microsoft_id FROM users
       WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
         AND is_active = false
         AND microsoft_id NOT LIKE 'pending-%'
       LIMIT 1) IS NOT NULL;

-- Step 2: Change deactivated user's email to avoid UNIQUE conflict
UPDATE users
SET email = 'ledenyi.emoke.DEACTIVATED@visoro-global.ro', updated_at = NOW()
WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
  AND is_active = false;

-- Step 3: Now safely update the active user's email to match Microsoft SSO
UPDATE users
SET email = 'ledenyi.emoke@visoro-global.ro', updated_at = NOW()
WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro'
  AND is_active = true;
