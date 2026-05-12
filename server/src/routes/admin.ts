import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { generateApiToken, hashToken } from '../middleware/apiTokenAuth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// --- Avatar upload setup for admin (memory storage — stored in DB) ---
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Doar imagini (jpg, png, gif, webp) sunt permise.'));
        }
    }
});

// GET /api/admin/users — list all users with their departments, roles, and
// the IDs of companies they have access to.
router.get('/users', asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.microsoft_id, u.email, u.display_name, u.avatar_url,
                   u.departments, u.role, u.is_active, u.created_at, u.updated_at,
                   COALESCE(
                       (SELECT array_agg(uc.company_id ORDER BY uc.company_id)
                          FROM user_companies uc
                         WHERE uc.user_id = u.id),
                       ARRAY[]::int[]
                   ) AS company_ids
              FROM users u
             WHERE u.is_active = true
             ORDER BY u.display_name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea utilizatorilor.' });
    }
}));

// PUT /api/admin/users/:id/companies — replace the user's company access list.
// Superadmin only (Robert is the sole authority on cross-company access).
router.put('/users/:id/companies', requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.id;
    const raw = req.body?.company_ids;
    if (!Array.isArray(raw)) {
        res.status(400).json({ error: 'company_ids trebuie să fie un array.' });
        return;
    }
    const companyIds = Array.from(new Set(raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)));

    // Verify the user exists.
    const userExists = await pool.query('SELECT 1 FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (userExists.rowCount === 0) {
        res.status(404).json({ error: 'Utilizator inexistent.' });
        return;
    }

    // Verify every company id refers to an existing, non-archived company.
    if (companyIds.length > 0) {
        const { rows } = await pool.query<{ id: number }>(
            'SELECT id FROM companies WHERE id = ANY($1::int[]) AND is_archived = false',
            [companyIds]
        );
        const valid = new Set(rows.map((r) => r.id));
        const invalid = companyIds.filter((id) => !valid.has(id));
        if (invalid.length > 0) {
            res.status(400).json({ error: `Companii inexistente sau arhivate: ${invalid.join(', ')}` });
            return;
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM user_companies WHERE user_id = $1', [userId]);
        if (companyIds.length > 0) {
            const valuesSql = companyIds.map((_, i) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO user_companies (user_id, company_id) VALUES ${valuesSql}`,
                [userId, ...companyIds]
            );
        }
        await client.query('COMMIT');
        res.json({ user_id: userId, company_ids: companyIds });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// Role hierarchy ranks — higher number means more privileged.
const ROLE_RANK: Record<string, number> = {
    user: 1,
    manager: 2,
    admin: 3,
    superadmin: 4,
};
function rank(role: string | undefined | null): number {
    return ROLE_RANK[role ?? 'user'] ?? 0;
}

// PATCH /api/admin/users/:id — update user role and/or departments
router.patch('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { role, departments, email } = req.body;

    const callerRole = req.user!.role;
    const isSuperadmin = callerRole === 'superadmin';
    const isAdmin = callerRole === 'admin';

    // Load target user for hierarchy checks (cannot modify peers/superiors).
    const { rows: targetRows } = await pool.query<{ id: string; role: string }>(
        'SELECT id, role FROM users WHERE id = $1',
        [id]
    );
    if (targetRows.length === 0) {
        res.status(404).json({ error: 'Utilizator negăsit.' });
        return;
    }
    const target = targetRows[0];
    const callerId = req.user!.id;

    // Hierarchy guard: an admin cannot modify a peer admin or any superadmin
    // (only superadmins can touch admins/superadmins).
    if (!isSuperadmin && target.id !== callerId && rank(target.role) >= rank(callerRole)) {
        res.status(403).json({ error: 'Nu poți modifica un utilizator cu rol egal sau superior.' });
        return;
    }

    // Superadmin may set any role; a regular admin can only set 'user' or 'manager'.
    const allowed_roles = isSuperadmin
        ? ['superadmin', 'admin', 'manager', 'user']
        : ['user', 'manager'];
    const allowed_departments = ['departament_1', 'departament_2', 'departament_3', 'departament_4', 'departament_5', 'departament_6', 'departament_7'];

    if (role) {
        if (role === 'superadmin' && !isSuperadmin) {
            res.status(403).json({ error: 'Nu ai permisiunea să atribui rolul de superadmin.' });
            return;
        }
        if (!allowed_roles.includes(role)) {
            res.status(403).json({ error: 'Nu ai permisiunea să atribui acest rol.' });
            return;
        }
        // Disallow demoting yourself or changing roles upward beyond your own rank.
        if (rank(role) > rank(callerRole)) {
            res.status(403).json({ error: 'Nu poți atribui un rol superior celui propriu.' });
            return;
        }
    }

    // Email change: only superadmin may change another user's email
    // (admins changing emails enables account takeover via SSO upsert).
    if (email && !isSuperadmin && target.id !== callerId) {
        res.status(403).json({ error: 'Doar superadmin poate modifica email-ul altui utilizator.' });
        return;
    }

    // Department change scope guard for non-superadmin admins:
    // they may only modify users with whom they share at least one company.
    if (departments && isAdmin && !isSuperadmin && req.user!.id !== id) {
        const { rows: shared } = await pool.query(
            `SELECT 1
               FROM user_companies uc_target
               JOIN user_companies uc_caller
                 ON uc_caller.company_id = uc_target.company_id
              WHERE uc_target.user_id = $1
                AND uc_caller.user_id = $2
              LIMIT 1`,
            [id, req.user!.id]
        );
        if (shared.length === 0) {
            res.status(403).json({ error: 'Nu poți modifica un utilizator dintr-o companie din afara ariei tale.' });
            return;
        }
    }

    if (departments) {
        if (!Array.isArray(departments)) {
            res.status(400).json({ error: 'Departamentele trebuie să fie un array.' });
            return;
        }
        for (const d of departments) {
            if (!allowed_departments.includes(d)) {
                res.status(400).json({ error: `Departament invalid: ${d}` });
                return;
            }
        }
    }

    if (email && (typeof email !== 'string' || !email.includes('@'))) {
        res.status(400).json({ error: 'Email invalid.' });
        return;
    }

    try {
        const setParts: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (role) { setParts.push(`role = $${idx++}`); values.push(role); }
        if (departments) { setParts.push(`departments = $${idx++}`); values.push(departments); }
        if (email) { setParts.push(`email = $${idx++}`); values.push(email); }

        if (setParts.length === 0) {
            res.status(400).json({ error: 'Nimic de actualizat.' });
            return;
        }

        setParts.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE users SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ error: 'Eroare la actualizarea utilizatorului.' });
    }
}));

// POST /api/admin/users — create a new user manually (no Microsoft SSO needed)
router.post('/users', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, display_name, role, departments } = req.body;

    if (!email || !display_name) {
        res.status(400).json({ error: 'Email și nume sunt obligatorii.' });
        return;
    }

    const callerRole = req.user!.role;
    const isSuperadmin = callerRole === 'superadmin';

    // Superadmin may grant any role; a regular admin can only create users with role 'user' or 'manager'.
    const allowed_roles = isSuperadmin
        ? ['superadmin', 'admin', 'manager', 'user']
        : ['user', 'manager'];

    if (role) {
        if (role === 'superadmin' && !isSuperadmin) {
            res.status(403).json({ error: 'Nu ai permisiunea să atribui rolul de superadmin.' });
            return;
        }
        if (!allowed_roles.includes(role)) {
            res.status(403).json({ error: 'Nu ai permisiunea să atribui acest rol.' });
            return;
        }
    }
    const userRole = role && allowed_roles.includes(role) ? role : 'user';

    // Check if email already exists (including deactivated)
    const { rows: existing } = await pool.query(
        'SELECT id, is_active FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
    );
    if (existing.length > 0) {
        if (!existing[0].is_active) {
            // Reactivate
            const { rows } = await pool.query(
                `UPDATE users SET is_active = true, display_name = $2, role = $3, departments = $4, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [existing[0].id, display_name, userRole, departments || []]
            );
            res.status(200).json(rows[0]);
            return;
        }
        res.status(409).json({ error: 'Un utilizator cu acest email există deja.' });
        return;
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO users (id, microsoft_id, email, display_name, role, departments)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
             RETURNING *`,
            [`pending-${Date.now()}`, email, display_name, userRole, departments || []]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Admin create user error:', err);
        res.status(500).json({ error: 'Eroare la crearea utilizatorului.' });
    }
}));

// DELETE /api/admin/users/:id — deactivate (soft delete via role change, not actual delete)
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (req.user?.id === id) {
        res.status(400).json({ error: 'Nu poți șterge propriul cont.' });
        return;
    }

    // Hierarchy guard: only superadmin may deactivate admins/superadmins.
    const callerRole = req.user!.role;
    const isSuperadmin = callerRole === 'superadmin';
    const { rows: targetRows } = await pool.query<{ role: string }>(
        'SELECT role FROM users WHERE id = $1',
        [id]
    );
    if (targetRows.length === 0) {
        res.status(404).json({ error: 'Utilizator negăsit.' });
        return;
    }
    if (!isSuperadmin && rank(targetRows[0].role) >= rank(callerRole)) {
        res.status(403).json({ error: 'Nu poți dezactiva un utilizator cu rol egal sau superior.' });
        return;
    }

    try {
        const { rows } = await pool.query(
            `UPDATE users SET is_active = false, deactivated_at = NOW() WHERE id = $1 AND is_active = true RETURNING id, display_name`,
            [id]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        res.json({ success: true, deactivated: rows[0] });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Eroare la ștergerea utilizatorului.' });
    }
}));

// GET /api/admin/stats — overview stats for admin (scoped to active company)
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.activeCompanyId === undefined) {
        res.status(400).json({ error: 'Companie activă lipsește.' });
        return;
    }
    try {
        const companyId = req.activeCompanyId;
        const { rows: [stats] } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users u
                   WHERE u.is_active = true
                     AND (u.role IN ('admin','superadmin')
                          OR EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id = u.id AND uc.company_id = $1))
                ) as total_users,
                (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND deleted_at IS NULL) as total_tasks,
                (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND deleted_at IS NULL AND status = 'terminat') as completed_tasks,
                (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND deleted_at IS NULL AND status = 'blocat') as blocked_tasks,
                (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND deleted_at IS NULL AND due_date < NOW() AND status != 'terminat') as overdue_tasks
        `, [companyId]);
        res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor.' });
    }
}));

// ==========================================
// API TOKEN MANAGEMENT
// ==========================================

// POST /api/admin/api-tokens — generate a new API token
router.post('/api-tokens', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { name, expires_at } = req.body;

        if (!name || name.trim() === '') {
            res.status(400).json({ error: 'Numele token-ului este obligatoriu.' });
            return;
        }

        const rawToken = generateApiToken();
        const tokenHash = hashToken(rawToken);

        const { rows } = await pool.query(
            `INSERT INTO api_tokens (token_hash, name, created_by, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, created_at, expires_at`,
            [tokenHash, name.trim(), req.user!.id, expires_at || null]
        );

        // Return the raw token ONCE — it will never be shown again
        res.status(201).json({
            ...rows[0],
            token: rawToken,
            message: 'Salvează acest token! Nu va mai fi afișat.'
        });
    } catch (err) {
        console.error('Generate API token error:', err);
        res.status(500).json({ error: 'Eroare la generarea token-ului.' });
    }
}));

// GET /api/admin/api-tokens — list tokens visible to the caller. Superadmins
// see all; regular admins only see tokens they created themselves.
router.get('/api-tokens', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const isSuperadmin = req.user!.role === 'superadmin';
        const { rows } = isSuperadmin
            ? await pool.query(`
                SELECT at.id, at.name, at.is_active, at.created_at, at.last_used_at, at.expires_at,
                       u.display_name AS created_by_name
                FROM api_tokens at
                JOIN users u ON at.created_by = u.id
                ORDER BY at.created_at DESC
            `)
            : await pool.query(`
                SELECT at.id, at.name, at.is_active, at.created_at, at.last_used_at, at.expires_at,
                       u.display_name AS created_by_name
                FROM api_tokens at
                JOIN users u ON at.created_by = u.id
                WHERE at.created_by = $1
                ORDER BY at.created_at DESC
            `, [req.user!.id]);
        res.json(rows);
    } catch (err) {
        console.error('List API tokens error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea token-urilor.' });
    }
}));

// DELETE /api/admin/api-tokens/:id — revoke a token
router.delete('/api-tokens/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `UPDATE api_tokens SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND is_active = true
             RETURNING id, name`,
            [id]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Token negăsit sau deja revocat.' });
            return;
        }

        res.json({ success: true, revoked: rows[0] });
    } catch (err) {
        console.error('Revoke API token error:', err);
        res.status(500).json({ error: 'Eroare la revocarea token-ului.' });
    }
}));

// ==========================================
// ADMIN AVATAR UPLOAD
// ==========================================

// POST /api/admin/users/:id/avatar — upload avatar for any user (stored in PostgreSQL)
router.post('/users/:id/avatar', (req: AuthRequest, res: Response, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Eroare upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'Imaginea este obligatorie.' });
        return;
    }

    // Check user exists
    const { rows: currentUser } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (currentUser.length === 0) {
        res.status(404).json({ error: 'Utilizator negăsit.' });
        return;
    }

    // Store avatar binary data in PostgreSQL
    const avatarUrl = `/api/files/avatar/${id}`;

    const { rows } = await pool.query(
        `UPDATE users SET avatar_url = $1, avatar_data = $2, avatar_mime = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, display_name, avatar_url, departments, role`,
        [avatarUrl, file.buffer, file.mimetype, id]
    );

    res.json(rows[0]);
}));

export default router;

