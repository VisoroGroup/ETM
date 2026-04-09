-- Migration 051: Add reports_to hierarchy field to users table
-- Tracks who each user reports to (can be multiple superiors)

ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to UUID[] DEFAULT '{}';

-- Populate hierarchy based on email addresses
-- Ledenyi Robert → no superior (CEO)
-- Maria Vaszi → reports to Ledenyi Robert
-- Ledenyi Emoke → reports to Maria Vaszi AND Ledenyi Robert
-- Alisa Marincas → reports to Ledenyi Robert AND Maria Vaszi
-- Molnar Timea → reports to Ledenyi Emoke

UPDATE users SET reports_to = '{}'
WHERE LOWER(email) LIKE '%robert%' AND LOWER(display_name) LIKE '%ledenyi%';

UPDATE users SET reports_to = ARRAY(
    SELECT id FROM users WHERE LOWER(email) LIKE '%robert%' AND LOWER(display_name) LIKE '%ledenyi%' LIMIT 1
)
WHERE LOWER(email) LIKE '%maria.vaszi%';

UPDATE users SET reports_to = ARRAY(
    SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' LIMIT 1
) || ARRAY(
    SELECT id FROM users WHERE LOWER(email) LIKE '%robert%' AND LOWER(display_name) LIKE '%ledenyi%' LIMIT 1
)
WHERE LOWER(email) LIKE '%emoke%';

UPDATE users SET reports_to = ARRAY(
    SELECT id FROM users WHERE LOWER(email) LIKE '%robert%' AND LOWER(display_name) LIKE '%ledenyi%' LIMIT 1
) || ARRAY(
    SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' LIMIT 1
)
WHERE LOWER(email) LIKE '%alisa%';

UPDATE users SET reports_to = ARRAY(
    SELECT id FROM users WHERE LOWER(email) LIKE '%emoke%' LIMIT 1
)
WHERE LOWER(email) LIKE '%timea%';
