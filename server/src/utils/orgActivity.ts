import pool from '../config/database';

export type OrgActionType =
    | 'post_created' | 'post_user_changed' | 'post_deleted'
    | 'section_created' | 'section_deleted'
    | 'department_created' | 'department_deleted'
    | 'policy_uploaded' | 'policy_attached' | 'policy_detached' | 'policy_deleted';

export type OrgTargetType = 'post' | 'section' | 'department' | 'policy';

/**
 * Append a row to the org-structure audit log. Failures are swallowed and
 * logged — never block the caller's mutation on a logging error.
 */
export async function logOrgEvent(args: {
    companyId: number;
    userId: string;
    actionType: OrgActionType;
    targetType: OrgTargetType;
    targetId: string | null;
    details?: Record<string, unknown>;
}): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO org_activity_log (company_id, user_id, action_type, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [args.companyId, args.userId, args.actionType, args.targetType,
             args.targetId, JSON.stringify(args.details ?? {})]
        );
    } catch (err) {
        console.error('[orgActivity] log error:', err);
    }
}
