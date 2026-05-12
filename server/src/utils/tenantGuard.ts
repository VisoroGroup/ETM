import pool from '../config/database';

/**
 * Tenant-membership helpers. Routes use these to refuse user/post/section/etc.
 * UUIDs that come from another company's tenant — middleware/validation only
 * verifies UUID shape, not membership, so without these checks an attacker
 * (or buggy client) can write cross-company references into the active tenant.
 */

// Returns true iff `userId` is allowed in `companyId` — either an
// admin/superadmin (cross-tenant by role) or a member via user_companies.
export async function userIsInCompany(userId: string, companyId: number): Promise<boolean> {
    const { rows } = await pool.query(
        `SELECT 1
           FROM users u
          WHERE u.id = $1 AND u.is_active = true
            AND (u.role IN ('admin','superadmin')
                 OR EXISTS (SELECT 1 FROM user_companies uc
                             WHERE uc.user_id = u.id AND uc.company_id = $2))
          LIMIT 1`,
        [userId, companyId]
    );
    return rows.length > 0;
}

// Batched version. Returns the subset of `userIds` that belong to the company.
// Use this before INSERTing many user_id references at once (subtasks, mentions).
export async function filterUsersInCompany(userIds: string[], companyId: number): Promise<string[]> {
    if (userIds.length === 0) return [];
    const { rows } = await pool.query<{ id: string }>(
        `SELECT u.id
           FROM users u
          WHERE u.id = ANY($1::uuid[]) AND u.is_active = true
            AND (u.role IN ('admin','superadmin')
                 OR EXISTS (SELECT 1 FROM user_companies uc
                             WHERE uc.user_id = u.id AND uc.company_id = $2))`,
        [userIds, companyId]
    );
    return rows.map((r) => r.id);
}

// Verify a post/section/department UUID belongs to the active tenant.
// We could write three separate functions, but they all hit the same shape.
export async function rowIsInCompany(
    table: 'posts' | 'sections' | 'departments',
    id: string,
    companyId: number,
): Promise<boolean> {
    // table name is a fixed literal from the union; safe to inline.
    const { rows } = await pool.query(
        `SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2 LIMIT 1`,
        [id, companyId]
    );
    return rows.length > 0;
}
