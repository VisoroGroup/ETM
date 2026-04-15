-- Migration 063: Remove duplicate posts created by double-run of 055 + 062
-- Keeps the post that has tasks assigned to it, or the oldest one if neither has tasks

DELETE FROM posts WHERE id IN (
  SELECT p2.id
  FROM posts p1
  JOIN posts p2 ON p1.name = p2.name
    AND p1.section_id = p2.section_id
    AND p1.is_active = true
    AND p2.is_active = true
    AND p1.id < p2.id
  WHERE NOT EXISTS (
    SELECT 1 FROM tasks t WHERE t.assigned_post_id = p2.id AND t.deleted_at IS NULL
  )
);
