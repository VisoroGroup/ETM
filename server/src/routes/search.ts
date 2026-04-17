import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

/**
 * Global search across every searchable entity, diacritics-insensitive.
 * Uses the `unaccent` extension so "plati" matches "plăți" and "Sș" matches "Ss".
 *
 * Scope rules:
 *  - superadmin / admin / manager: see everything
 *  - user: only see tasks they can access (creator, assignee, subtask assignee)
 *    and comments/attachments on those tasks; users/posts/departments/sections
 *    are public metadata so everyone can search them.
 *
 * Returns grouped results:
 *   { tasks, comments, attachments, policies, users, posts, sections, departments }
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = ((req.query.q as string) || '').trim();
    if (q.length < 1) {
        res.json({
            tasks: [], comments: [], attachments: [], policies: [],
            users: [], posts: [], sections: [], departments: [],
            total: 0
        });
        return;
    }

    // Normalize the search term: lowercase + unaccent happens in SQL via f_unaccent()
    // We send the raw query and let Postgres do the accent-stripping comparison.
    const pattern = `%${q.toLowerCase()}%`;
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 25);

    const isPrivileged = req.user!.role === 'superadmin'
        || req.user!.role === 'admin'
        || req.user!.role === 'manager';
    const userId = req.user!.id;

    // Task access clause (for comments/attachments): joins the parent task and
    // ensures a regular user only sees their own. Privileged roles see all.
    const taskAccessClause = isPrivileged
        ? ''
        : `AND (
            t.created_by = $3
            OR t.assigned_to = $3
            OR EXISTS (SELECT 1 FROM subtasks st WHERE st.task_id = t.id AND st.assigned_to = $3)
          )`;

    const params: any[] = [pattern, limit];
    if (!isPrivileged) params.push(userId);

    // Tasks (title, description)
    const { rows: tasks } = await pool.query(`
        SELECT t.id, t.title, t.description, t.status, t.due_date,
               t.assigned_to, t.created_by,
               u.display_name AS creator_name,
               au.display_name AS assignee_name,
               t.assigned_post_id,
               p.name AS post_name,
               s.name AS section_name,
               d.name AS department_name
        FROM tasks t
        JOIN users u ON t.created_by = u.id
        LEFT JOIN users au ON t.assigned_to = au.id
        LEFT JOIN posts p ON t.assigned_post_id = p.id
        LEFT JOIN sections s ON p.section_id = s.id
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE t.deleted_at IS NULL
          AND (
              f_unaccent(lower(t.title)) LIKE f_unaccent($1)
              OR f_unaccent(lower(COALESCE(t.description, ''))) LIKE f_unaccent($1)
          )
          ${taskAccessClause}
        ORDER BY t.updated_at DESC
        LIMIT $2
    `, params);

    // Comments — content match; reveal the parent task for navigation.
    // Note: task_comments has no deleted_at column (deletes are hard-deletes),
    // so we don't filter on it.
    const { rows: comments } = await pool.query(`
        SELECT tc.id, tc.task_id, tc.content, tc.created_at,
               tc.author_id,
               u.display_name AS author_name,
               t.title AS task_title, t.status AS task_status
        FROM task_comments tc
        JOIN tasks t ON tc.task_id = t.id
        JOIN users u ON tc.author_id = u.id
        WHERE t.deleted_at IS NULL
          AND f_unaccent(lower(tc.content)) LIKE f_unaccent($1)
          ${taskAccessClause}
        ORDER BY tc.created_at DESC
        LIMIT $2
    `, params);

    // Attachments — filename match.
    // task_attachments columns: file_name (not "filename") + created_at (not "uploaded_at").
    // We alias them so the frontend doesn't have to care about the server schema.
    const { rows: attachments } = await pool.query(`
        SELECT ta.id, ta.task_id,
               ta.file_name AS filename,
               ta.file_size,
               ta.created_at AS uploaded_at,
               t.title AS task_title
        FROM task_attachments ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE t.deleted_at IS NULL
          AND f_unaccent(lower(ta.file_name)) LIKE f_unaccent($1)
          ${taskAccessClause}
        ORDER BY ta.created_at DESC
        LIMIT $2
    `, params);

    // The remaining entities are metadata — no per-user scoping (privileged or not, everyone sees them)
    const metaParams: any[] = [pattern, limit];

    // Policies use content_html (HTML source) as the body column.
    // We strip tags for the match so searching for a plain word hits the text content.
    const { rows: policies } = await pool.query(`
        SELECT p.id, p.title, p.scope,
               p.content_html AS content,
               p.updated_at
        FROM policies p
        WHERE p.is_active = true
          AND (
              f_unaccent(lower(p.title)) LIKE f_unaccent($1)
              OR f_unaccent(lower(regexp_replace(COALESCE(p.content_html, ''), '<[^>]*>', ' ', 'g'))) LIKE f_unaccent($1)
          )
        ORDER BY p.updated_at DESC
        LIMIT $2
    `, metaParams);

    const { rows: users } = await pool.query(`
        SELECT u.id, u.display_name, u.email, u.avatar_url, u.role
        FROM users u
        WHERE u.is_active = true
          AND (
              f_unaccent(lower(u.display_name)) LIKE f_unaccent($1)
              OR f_unaccent(lower(u.email)) LIKE f_unaccent($1)
          )
        ORDER BY u.display_name ASC
        LIMIT $2
    `, metaParams);

    const { rows: posts } = await pool.query(`
        SELECT p.id, p.name, p.description, p.user_id,
               u.display_name AS user_name,
               s.name AS section_name,
               d.name AS department_name,
               d.id AS department_id
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        JOIN sections s ON p.section_id = s.id
        JOIN departments d ON s.department_id = d.id
        WHERE p.is_active = true AND s.is_active = true AND d.is_active = true
          AND (
              f_unaccent(lower(p.name)) LIKE f_unaccent($1)
              OR f_unaccent(lower(COALESCE(p.description, ''))) LIKE f_unaccent($1)
          )
        ORDER BY p.sort_order ASC
        LIMIT $2
    `, metaParams);

    const { rows: sections } = await pool.query(`
        SELECT s.id, s.name, s.pfv,
               d.id AS department_id, d.name AS department_name
        FROM sections s
        JOIN departments d ON s.department_id = d.id
        WHERE s.is_active = true AND d.is_active = true
          AND (
              f_unaccent(lower(s.name)) LIKE f_unaccent($1)
              OR f_unaccent(lower(COALESCE(s.pfv, ''))) LIKE f_unaccent($1)
          )
        ORDER BY s.sort_order ASC
        LIMIT $2
    `, metaParams);

    const { rows: departments } = await pool.query(`
        SELECT d.id, d.name, d.pfv, d.color
        FROM departments d
        WHERE d.is_active = true
          AND (
              f_unaccent(lower(d.name)) LIKE f_unaccent($1)
              OR f_unaccent(lower(COALESCE(d.pfv, ''))) LIKE f_unaccent($1)
          )
        ORDER BY d.sort_order ASC
        LIMIT $2
    `, metaParams);

    const total = tasks.length + comments.length + attachments.length + policies.length
        + users.length + posts.length + sections.length + departments.length;

    res.json({ tasks, comments, attachments, policies, users, posts, sections, departments, total });
}));

export default router;
