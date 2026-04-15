-- Migration 065: Fix typo in post name — "Bază de date clineți" should be "Bază de date clienți"
-- Delete the wrong one (created by 062 with typo)

DELETE FROM posts
WHERE name = 'Bază de date clineți'
AND is_active = true
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.assigned_post_id = posts.id AND t.deleted_at IS NULL);
