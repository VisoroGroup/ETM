-- Migration 064: Final duplicate posts cleanup
-- For each duplicate pair (same name + section_id), keep only the one that has tasks
-- If neither has tasks, keep the older one
-- If both have tasks, keep the one with more tasks (reassign the other's tasks first)

-- Step 1: Reassign tasks from duplicate posts to the "primary" post
-- Primary = the one with more tasks, or if tied, the older one
UPDATE tasks SET assigned_post_id = keeper.id
FROM (
  SELECT DISTINCT ON (p.name, p.section_id) p.id, p.name, p.section_id
  FROM posts p
  WHERE p.is_active = true
  ORDER BY p.name, p.section_id,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_post_id = p.id AND t.deleted_at IS NULL) DESC,
    p.created_at ASC
) keeper
JOIN posts dup ON dup.name = keeper.name AND dup.section_id = keeper.section_id AND dup.id != keeper.id AND dup.is_active = true
WHERE tasks.assigned_post_id = dup.id AND tasks.deleted_at IS NULL;

-- Step 2: Delete all duplicate posts (keep only the primary)
DELETE FROM posts WHERE id IN (
  SELECT dup.id
  FROM posts dup
  WHERE dup.is_active = true
  AND EXISTS (
    SELECT 1 FROM posts keeper
    WHERE keeper.name = dup.name
    AND keeper.section_id = dup.section_id
    AND keeper.is_active = true
    AND keeper.id != dup.id
    AND (
      keeper.created_at < dup.created_at
      OR (keeper.created_at = dup.created_at AND keeper.id < dup.id)
    )
  )
);
