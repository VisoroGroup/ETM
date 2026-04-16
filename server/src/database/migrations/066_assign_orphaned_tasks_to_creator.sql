-- Migration 066: Assign orphaned tasks (assigned_to IS NULL) to their creator.
--
-- Context: Prior to the validation fix, the zod schema silently stripped
-- assigned_post_id from task-create requests. Tasks created via the post
-- selector ended up with both assigned_to and assigned_post_id NULL,
-- showing as "Neasignat" in the drawer.
--
-- This backfill sets assigned_to = created_by for all active tasks that
-- currently have no responsible user. The creator can reassign later via
-- the TaskDrawer if needed.

UPDATE tasks
SET assigned_to = created_by,
    updated_at = NOW()
WHERE assigned_to IS NULL
  AND created_by IS NOT NULL
  AND deleted_at IS NULL
  AND status != 'terminat';
