import pool from '../config/database';

/**
 * Check if a user has access to a specific task.
 * - superadmin, admin, manager: always allowed
 * - user: must be creator, assignee, or subtask assignee
 */
export async function checkTaskAccess(taskId: string, userId: string, userRole: string): Promise<boolean> {
    if (['superadmin', 'admin', 'manager'].includes(userRole)) return true;

    const { rows } = await pool.query(`
        SELECT 1 FROM tasks WHERE id = $1 AND deleted_at IS NULL AND (
            created_by = $2 OR assigned_to = $2 OR
            EXISTS (SELECT 1 FROM subtasks WHERE task_id = $1 AND assigned_to = $2 AND deleted_at IS NULL)
        )`, [taskId, userId]);

    return rows.length > 0;
}
