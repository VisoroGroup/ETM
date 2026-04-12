import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

// HTML file upload setup (memory storage — stored in DB as text)
const htmlUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ['text/html', 'text/htm', 'application/xhtml+xml'];
        if (allowed.includes(file.mimetype) || file.originalname.endsWith('.html') || file.originalname.endsWith('.htm')) {
            cb(null, true);
        } else {
            cb(new Error('Doar fișiere HTML (.html, .htm) sunt permise.'));
        }
    }
});

// GET /api/policies — list all policies with optional scope filter
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { scope, department_id, post_id } = req.query;

    let query = `
        SELECT p.*, u.display_name as creator_name
        FROM policies p
        LEFT JOIN users u ON p.created_by_id = u.id
        WHERE p.is_active = true
    `;
    const params: any[] = [];

    if (scope) {
        params.push(scope);
        query += ` AND p.scope = $${params.length}`;
    }

    query += ' ORDER BY p.directive_number DESC NULLS LAST, p.date DESC';

    const { rows: policies } = await pool.query(query, params);

    // Get department/post associations for each policy
    const policyIds = policies.map((p: any) => p.id);
    if (policyIds.length > 0) {
        const { rows: deptLinks } = await pool.query(`
            SELECT pd.policy_id, d.id, d.name
            FROM policy_departments pd
            JOIN departments d ON pd.department_id = d.id
            WHERE pd.policy_id = ANY($1)
        `, [policyIds]);

        const { rows: postLinks } = await pool.query(`
            SELECT pp.policy_id, po.id, po.name
            FROM policy_posts pp
            JOIN posts po ON pp.post_id = po.id
            WHERE pp.policy_id = ANY($1)
        `, [policyIds]);

        policies.forEach((p: any) => {
            p.departments = deptLinks.filter((d: any) => d.policy_id === p.id).map((d: any) => ({ id: d.id, name: d.name }));
            p.posts = postLinks.filter((po: any) => po.policy_id === p.id).map((po: any) => ({ id: po.id, name: po.name }));
        });
    }

    // Optional: filter by department_id or post_id after loading
    let filtered = policies;
    if (department_id) {
        filtered = filtered.filter((p: any) =>
            p.scope === 'COMPANY' || p.departments?.some((d: any) => d.id === department_id)
        );
    }
    if (post_id) {
        filtered = filtered.filter((p: any) =>
            p.posts?.some((po: any) => po.id === post_id)
        );
    }

    res.json(filtered);
}));

// GET /api/policies/:id — single policy with full HTML content
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        SELECT p.*, u.display_name as creator_name
        FROM policies p
        LEFT JOIN users u ON p.created_by_id = u.id
        WHERE p.id = $1
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Directiva nu a fost găsită.' });
        return;
    }

    // Get associations
    const { rows: deptLinks } = await pool.query(`
        SELECT d.id, d.name FROM policy_departments pd JOIN departments d ON pd.department_id = d.id WHERE pd.policy_id = $1
    `, [id]);
    const { rows: postLinks } = await pool.query(`
        SELECT po.id, po.name FROM policy_posts pp JOIN posts po ON pp.post_id = po.id WHERE pp.policy_id = $1
    `, [id]);

    const policy = rows[0];
    policy.departments = deptLinks;
    policy.posts = postLinks;

    res.json(policy);
}));

// POST /api/policies/upload — upload HTML policy (superadmin only)
router.post('/upload', requireRole('superadmin'), htmlUpload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { directive_number, title, date, scope, department_ids, post_ids } = req.body;

    if (!title || !date || !scope) {
        res.status(400).json({ error: 'Titlul, data și scope-ul sunt obligatorii.' });
        return;
    }

    if (!['COMPANY', 'DEPARTMENT', 'POST'].includes(scope)) {
        res.status(400).json({ error: 'Scope invalid. Valori posibile: COMPANY, DEPARTMENT, POST.' });
        return;
    }

    // Get HTML content from file or body
    let content_html = '';
    if (req.file) {
        content_html = req.file.buffer.toString('utf-8');
    } else if (req.body.content_html) {
        content_html = req.body.content_html;
    } else {
        res.status(400).json({ error: 'Fișierul HTML sau conținutul HTML este obligatoriu.' });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insert policy
        const { rows } = await client.query(`
            INSERT INTO policies (directive_number, title, date, content_html, scope, created_by_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [directive_number || null, title, date, content_html, scope, req.user!.id]);

        const policyId = rows[0].id;

        // Link to departments
        if (scope === 'DEPARTMENT' && department_ids) {
            const deptIds = typeof department_ids === 'string' ? JSON.parse(department_ids) : department_ids;
            for (const deptId of deptIds) {
                await client.query(
                    'INSERT INTO policy_departments (policy_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [policyId, deptId]
                );
            }
        }

        // Link to posts
        if (scope === 'POST' && post_ids) {
            const pIds = typeof post_ids === 'string' ? JSON.parse(post_ids) : post_ids;
            for (const postId of pIds) {
                await client.query(
                    'INSERT INTO policy_posts (policy_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [policyId, postId]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// PUT /api/policies/:id — update policy (superadmin only)
router.put('/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { directive_number, title, date, scope, content_html, department_ids, post_ids } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(`
            UPDATE policies SET
                directive_number = COALESCE($1, directive_number),
                title = COALESCE($2, title),
                date = COALESCE($3, date),
                scope = COALESCE($4, scope),
                content_html = COALESCE($5, content_html),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [directive_number, title, date, scope, content_html, id]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ error: 'Directiva nu a fost găsită.' });
            return;
        }

        // Update department links if provided
        if (department_ids !== undefined) {
            await client.query('DELETE FROM policy_departments WHERE policy_id = $1', [id]);
            const deptIds = typeof department_ids === 'string' ? JSON.parse(department_ids) : department_ids;
            for (const deptId of (deptIds || [])) {
                await client.query(
                    'INSERT INTO policy_departments (policy_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, deptId]
                );
            }
        }

        // Update post links if provided
        if (post_ids !== undefined) {
            await client.query('DELETE FROM policy_posts WHERE policy_id = $1', [id]);
            const pIds = typeof post_ids === 'string' ? JSON.parse(post_ids) : post_ids;
            for (const postId of (pIds || [])) {
                await client.query(
                    'INSERT INTO policy_posts (policy_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, postId]
                );
            }
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

// DELETE /api/policies/:id — soft delete (superadmin only)
router.delete('/:id', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { rows } = await pool.query(`
        UPDATE policies SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id
    `, [id]);

    if (rows.length === 0) {
        res.status(404).json({ error: 'Directiva nu a fost găsită.' });
        return;
    }
    res.json({ message: 'Directiva a fost dezactivată.' });
}));

export default router;
