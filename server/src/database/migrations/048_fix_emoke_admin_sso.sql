-- Migration 048: Fix Emőke admin account for SSO login
--
-- After manual deletion of the duplicate "Ledényi Emőke" user account,
-- the remaining "Emőke Ledényi" admin account still has:
--   - email: Emoke.ledenyi@visoro-global.ro (doesn't match SSO)
--   - microsoft_id: pending-... (not linked to SSO)
--
-- We need to:
--   1. Copy the real microsoft_id from the deactivated user to the admin account
--   2. Update the admin account email to match what Microsoft SSO sends

-- Step 1: Copy real microsoft_id from deactivated account to admin account
UPDATE users
SET microsoft_id = (
    SELECT microsoft_id FROM users
    WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
      AND is_active = false
      AND microsoft_id NOT LIKE 'pending-%'
      AND microsoft_id NOT LIKE 'DEACTIVATED-%'
    LIMIT 1
),
    email = 'ledenyi.emoke@visoro-global.ro',
    updated_at = NOW()
WHERE LOWER(email) LIKE '%emoke.ledenyi@visoro-global.ro%'
  AND is_active = true
  AND microsoft_id LIKE 'pending-%'
  AND (
    SELECT microsoft_id FROM users
    WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
      AND is_active = false
      AND microsoft_id NOT LIKE 'pending-%'
      AND microsoft_id NOT LIKE 'DEACTIVATED-%'
    LIMIT 1
  ) IS NOT NULL;

-- Step 2: Clean up — fully deactivate the old user so it can't be reactivated via SSO
UPDATE users
SET microsoft_id = 'MERGED-' || microsoft_id,
    email = 'ledenyi.emoke.MERGED@visoro-global.ro',
    updated_at = NOW()
WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
  AND is_active = false
  AND microsoft_id NOT LIKE 'MERGED-%'
  AND microsoft_id NOT LIKE 'DEACTIVATED-%'
  AND microsoft_id NOT LIKE 'pending-%';
