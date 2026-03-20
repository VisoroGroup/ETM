import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// GET /api/admin/users — list all users with their departments and roles
router.get('/users', async (_req: AuthRequest, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, microsoft_id, email, display_name, avatar_url, departments, role, created_at, updated_at
            FROM users
            ORDER BY display_name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea utilizatorilor.' });
    }
});

// PATCH /api/admin/users/:id — update user role and/or departments
router.patch('/users/:id', async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { role, departments } = req.body;

    const allowed_roles = ['admin', 'manager', 'user'];
    const allowed_departments = ['departament_1', 'departament_2', 'departament_3', 'departament_4', 'departament_5', 'departament_6', 'departament_7'];

    if (role && !allowed_roles.includes(role)) {
        res.status(400).json({ error: 'Rol invalid.' });
        return;
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

    try {
        const setParts: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (role) { setParts.push(`role = $${idx++}`); values.push(role); }
        if (departments) { setParts.push(`departments = $${idx++}`); values.push(departments); }

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
});

// DELETE /api/admin/users/:id — deactivate (soft delete via role change, not actual delete)
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (req.user?.id === id) {
        res.status(400).json({ error: 'Nu poți șterge propriul cont.' });
        return;
    }

    try {
        const { rows } = await pool.query(
            `DELETE FROM users WHERE id = $1 RETURNING id, display_name`,
            [id]
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Utilizator negăsit.' });
            return;
        }

        res.json({ success: true, deleted: rows[0] });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Eroare la ștergerea utilizatorului.' });
    }
});

// GET /api/admin/stats — overview stats for admin
router.get('/stats', async (_req: AuthRequest, res: Response) => {
    try {
        const { rows: [stats] } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM tasks) as total_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'terminat') as completed_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'blocat') as blocked_tasks,
                (SELECT COUNT(*) FROM tasks WHERE due_date < NOW() AND status != 'terminat') as overdue_tasks
        `);
        res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea statisticilor.' });
    }
});

export default router;
