import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All department routes require authentication
router.use(authMiddleware);

// ============================================================
// DEPARTMENTS
// ============================================================

// GET /api/departments — list all departments with sections and posts
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    // Departments
    const { rows: departments } = await pool.query(`
        SELECT d.*, u.display_name as head_user_name
        FROM departments d
        LEFT JOIN users u ON d.head_user_id = u.id
        WHERE d.is_active = true
        ORDER BY d.sort_order ASC
    `);

    // Sections with post counts
    const { rows: sections } = await pool.query(`
        SELECT s.*, u.display_name as head_user_name, d.name as department_name
        FROM sections s
        LEFT JOIN users u ON s.head_user_id = u.id
        JOIN departments d ON s.department_id = d.id
        WHERE s.is_active = true AND d.is_active = true
        ORDER BY s.sort_order ASC
    `);

    // Posts with user info and task counts (filtered by user role)
    const isRegularUser = req.user?.role === 'user';
    const userId = req.user?.id;

    // Task count subquery: admins/superadmins see all, regular users see only their own
    const taskCountSubquery = isRegularUser
        ? `SELECT assigned_post_id, COUNT(*)::int as task_count
           FROM tasks
           WHERE deleted_at IS NULL AND status != 'terminat'
             AND (created_by = $1 OR assigned_to = $1 OR EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = tasks.id AND st.assigned_to = $1))
           GROUP BY assigned_post_id`
        : `SELECT assigned_post_id, COUNT(*)::int as task_count
           FROM tasks
           WHERE deleted_at IS NULL AND status != 'terminat'
           GROUP BY assigned_post_id`;

    const { rows: posts } = await pool.query(`
        SELECT p.*,
            u.display_name as user_name,
            u.email as user_email,
            u.avatar_url as user_avatar,
            s.name as section_name,
            d.name as department_name,
            d.id as department_id,
            COALESCE(tc.task_count, 0)::int as task_count,
            COALESCE(pc.policy_count, 0)::int as policy_count
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        JOIN sections s ON p.section_id = s.id
        JOIN departments d ON s.department_id = d.id
        LEFT JOIN (${taskCountSubquery}) tc ON tc.assigned_post_id = p.id
        LEFT JOIN (
            SELECT pp.post_id, COUNT(*)::int as policy_count
            FROM policy_posts pp
            JOIN policies pol ON pp.policy_id = pol.id AND pol.is_active = true
            GROUP BY pp.post_id
        ) pc ON pc.post_id = p.id
        WHERE p.is_active = true AND s.is_active = true AND d.is_active = true
        ORDER BY p.sort_order ASC
    `, isRegularUser ? [userId] : []);

    // Department-level policy counts
    const { rows: deptPolicyCounts } = await pool.query(`
        SELECT pd.department_id, COUNT(*)::int as policy_count
        FROM policy_departments pd
        JOIN policies pol ON pd.policy_id = pol.id AND pol.is_active = true
        GROUP BY pd.department_id
    `);

    // Company-level policy count
    const { rows: companyPolicies } = await pool.query(`
        SELECT COUNT(*)::int as count FROM policies WHERE scope = 'COMPANY' AND is_active = true
    `);

    // Assemble nested structure
    const result = departments.map((dept: any) => {
        const deptSections = sections
            .filter((s: any) => s.department_id === dept.id)
            .map((sec: any) => ({
                ...sec,
                posts: posts.filter((p: any) => p.section_id === sec.id)
            }));
        const deptPolicyCount = deptPolicyCounts.find((dp: any) => dp.department_id === dept.id);
        return {
            ...dept,
            sections: deptSections,
            policy_count: deptPolicyCount?.policy_count || 0
        };
    });

    res.json({
        departments: result,
        company_policy_count: companyPolicies[0]?.count || 0
    });
}));

// GET /api/departments/:id — single department with full details
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        SELECT d.*, u.display_name as head_user_name
        FROM departments d
        LEFT JOIN users u ON d.head_user_id = u.id
        WHERE d.id = $1
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Departamentul nu a fost găsit.' });
        return;
    }
    res.json(rows[0]);
}));

// POST /api/departments — create department (superadmin only)
router.post('/', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, color, head_user_id, pfv, statistic_name } = req.body;
    if (!name || !color) {
        res.status(400).json({ error: 'Numele și culoarea sunt obligatorii.' });
        return;
    }

    // Get next sort_order
    const { rows: maxOrder } = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM departments');

    const { rows } = await pool.query(`
        INSERT INTO departments (name, sort_order, color, head_user_id, pfv, statistic_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [name, maxOrder[0].next_order, color, head_user_id || null, pfv || null, statistic_name || null]);

    res.status(201).json(rows[0]);
}));

// PUT /api/departments/:id — update department (superadmin only)
router.put('/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, color, head_user_id, pfv, statistic_name, sort_order } = req.body;

    const { rows } = await pool.query(`
        UPDATE departments SET
            name = COALESCE($1, name),
            color = COALESCE($2, color),
            head_user_id = $3,
            pfv = $4,
            statistic_name = $5,
            sort_order = COALESCE($6, sort_order),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
    `, [name, color, head_user_id || null, pfv || null, statistic_name || null, sort_order, id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Departamentul nu a fost găsit.' });
        return;
    }
    res.json(rows[0]);
}));

// DELETE /api/departments/:id — soft delete (superadmin only)
router.delete('/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        UPDATE departments SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Departamentul nu a fost găsit.' });
        return;
    }
    res.json({ message: 'Departamentul a fost dezactivat.' });
}));

// ============================================================
// SECTIONS (sub-departments)
// ============================================================

// GET /api/departments/:id/sections — sections within a department
router.get('/:id/sections', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        SELECT s.*, u.display_name as head_user_name
        FROM sections s
        LEFT JOIN users u ON s.head_user_id = u.id
        WHERE s.department_id = $1 AND s.is_active = true
        ORDER BY s.sort_order ASC
    `, [id]);
    res.json(rows);
}));

// POST /api/departments/:id/sections — create section (superadmin only)
router.post('/:id/sections', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const department_id = req.params.id;
    const { name, head_user_id, pfv } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Numele subdepartamentului este obligatoriu.' });
        return;
    }

    const { rows: maxOrder } = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM sections WHERE department_id = $1', [department_id]
    );

    const { rows } = await pool.query(`
        INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [name, department_id, head_user_id || null, pfv || null, maxOrder[0].next_order]);

    res.status(201).json(rows[0]);
}));

// PUT /api/sections/:id — update section (superadmin only)
router.put('/sections/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, head_user_id, pfv, sort_order } = req.body;

    const { rows } = await pool.query(`
        UPDATE sections SET
            name = COALESCE($1, name),
            head_user_id = $2,
            pfv = $3,
            sort_order = COALESCE($4, sort_order),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
    `, [name, head_user_id || null, pfv || null, sort_order, id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Subdepartamentul nu a fost găsit.' });
        return;
    }
    res.json(rows[0]);
}));

// DELETE /api/sections/:id — soft delete section (superadmin only)
router.delete('/sections/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        UPDATE sections SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Subdepartamentul nu a fost găsit.' });
        return;
    }
    res.json({ message: 'Subdepartamentul a fost dezactivat.' });
}));

// ============================================================
// POSTS (actual positions within sections)
// ============================================================

// GET /api/departments/sections/:sectionId/posts — posts within a section
router.get('/sections/:sectionId/posts', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sectionId } = req.params;
    const { rows } = await pool.query(`
        SELECT p.*,
            u.display_name as user_name,
            u.email as user_email,
            u.avatar_url as user_avatar
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.section_id = $1 AND p.is_active = true
        ORDER BY p.sort_order ASC
    `, [sectionId]);
    res.json(rows);
}));

// POST /api/departments/sections/:sectionId/posts — create post (admin + superadmin)
router.post('/sections/:sectionId/posts', requireRole('admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sectionId } = req.params;
    const { name, user_id, description } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Numele postului este obligatoriu.' });
        return;
    }

    const { rows: maxOrder } = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM posts WHERE section_id = $1', [sectionId]
    );

    const { rows } = await pool.query(`
        INSERT INTO posts (name, section_id, user_id, description, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [name, sectionId, user_id || null, description || null, maxOrder[0].next_order]);

    res.status(201).json(rows[0]);
}));

// PUT /api/departments/posts/:id — update post (superadmin only)
// IMPORTANT: When user_id changes, all tasks assigned to this post get their assigned_to updated
router.put('/posts/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, user_id, description, sort_order } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get old post to detect user change
        const { rows: oldPost } = await client.query('SELECT * FROM posts WHERE id = $1', [id]);
        if (oldPost.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ error: 'Postul nu a fost găsit.' });
            return;
        }

        const { rows } = await client.query(`
            UPDATE posts SET
                name = COALESCE($1, name),
                user_id = $2,
                description = $3,
                sort_order = COALESCE($4, sort_order),
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [name, user_id !== undefined ? user_id : null, description !== undefined ? description : null, sort_order, id]);

        // If user changed on this post, update assigned_to on ALL active tasks for this post
        const oldUserId = oldPost[0].user_id;
        const newUserId = user_id !== undefined ? (user_id || null) : oldUserId;

        if (user_id !== undefined && oldUserId !== newUserId) {
            await client.query(`
                UPDATE tasks SET
                    assigned_to = $1,
                    updated_at = NOW()
                WHERE assigned_post_id = $2 AND deleted_at IS NULL AND status != 'terminat'
            `, [newUserId, id]);
        }

        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// DELETE /api/departments/posts/:id — soft delete post (superadmin only)
router.delete('/posts/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        UPDATE posts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Postul nu a fost găsit.' });
        return;
    }
    res.json({ message: 'Postul a fost dezactivat.' });
}));

// GET /api/departments/posts/:id — single post with full details
router.get('/posts/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        SELECT p.*,
            u.display_name as user_name,
            u.email as user_email,
            u.avatar_url as user_avatar,
            s.name as section_name,
            d.name as department_name,
            d.id as department_id
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        JOIN sections s ON p.section_id = s.id
        JOIN departments d ON s.department_id = d.id
        WHERE p.id = $1
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Postul nu a fost găsit.' });
        return;
    }
    res.json(rows[0]);
}));

export default router;
