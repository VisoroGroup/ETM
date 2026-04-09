-- Migration 049: Simply update Emőke's email to match Microsoft SSO
--
-- The admin account still has the old email format (Emoke.ledenyi@).
-- Microsoft SSO sends ledenyi.emoke@ — so we just update the email directly.
-- Also copy microsoft_id from the deactivated SSO user if available.

-- First: update the email on the active admin account
UPDATE users
SET email = 'ledenyi.emoke@visoro-global.ro',
    updated_at = NOW()
WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro'
  AND is_active = true;

-- Second: copy real microsoft_id from deactivated user (if exists and has real ID)
UPDATE users
SET microsoft_id = sub.real_ms_id
FROM (
    SELECT microsoft_id AS real_ms_id
    FROM users
    WHERE is_active = false
      AND microsoft_id NOT LIKE 'pending-%'
      AND microsoft_id NOT LIKE 'DEACTIVATED-%'
      AND microsoft_id NOT LIKE 'MERGED-%'
      AND (LOWER(email) LIKE '%emoke%' OR LOWER(email) LIKE '%emőke%')
    LIMIT 1
) sub
WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro'
  AND is_active = true
  AND microsoft_id LIKE 'pending-%';

-- Third: mark deactivated SSO user so it can't be reactivated
UPDATE users
SET microsoft_id = 'MERGED-' || microsoft_id,
    email = REPLACE(LOWER(email), '@', '.MERGED@'),
    updated_at = NOW()
WHERE is_active = false
  AND (LOWER(email) LIKE '%emoke%' OR LOWER(email) LIKE '%emőke%')
  AND microsoft_id NOT LIKE 'pending-%'
  AND microsoft_id NOT LIKE 'DEACTIVATED-%'
  AND microsoft_id NOT LIKE 'MERGED-%';
