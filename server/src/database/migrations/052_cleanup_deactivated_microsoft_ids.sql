-- Migration 052: Clean up deactivated users' microsoft_id values
-- Prevents UNIQUE constraint conflicts when active users try to link their Microsoft account.
-- Any deactivated user with a real (non-prefixed) microsoft_id gets it prefixed with 'DEACTIVATED-'.

UPDATE users
SET microsoft_id = 'DEACTIVATED-' || microsoft_id,
    updated_at = NOW()
WHERE is_active = false
  AND microsoft_id IS NOT NULL
  AND microsoft_id NOT LIKE 'pending-%'
  AND microsoft_id NOT LIKE 'DEACTIVATED-%'
  AND microsoft_id NOT LIKE 'MERGED-%'
  AND microsoft_id NOT LIKE 'CLEARED-%';
