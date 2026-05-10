import pool from '../config/database';

/**
 * Check if a user has access to a specific task — TENANT-SCOPED.
 *
 * - superadmin, admin, manager: allowed for any task in the active company
 * - user: must be creator, assignee, or subtask assignee — within the active company
 *
 * `companyId` is REQUIRED for tenant isolation. If undefined, access is denied
 * (the caller must derive it from req.activeCompanyId).
 */
export async function checkTaskAccess(
    taskId: string,
    userId: string,
    userRole: string,
    companyId?: number | undefined
): Promise<boolean> {
    if (companyId === undefined || companyId === null) return false;

    if (['superadmin', 'admin', 'manager'].includes(userRole)) {
        // Privileged roles still need to be in the same tenant
        const { rows } = await pool.query(
            `SELECT 1 FROM tasks WHERE id = $1 AND deleted_at IS NULL AND company_id = $2`,
            [taskId, companyId]
        );
        return rows.length > 0;
    }

    const { rows } = await pool.query(`
        SELECT 1 FROM tasks t
        WHERE t.id = $1 AND t.deleted_at IS NULL AND t.company_id = $3 AND (
            t.created_by = $2 OR t.assigned_to = $2 OR
            EXISTS (SELECT 1 FROM subtasks WHERE task_id = $1 AND assigned_to = $2 AND deleted_at IS NULL)
        )`, [taskId, userId, companyId]);

    return rows.length > 0;
}
