import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/activity-feed — global activity feed with filters and pagination
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            user_id,
            department,
            action_type,
            page = '1',
            limit = '50'
        } = req.query;

        const isAdmin = req.user!.role === 'admin';
        const conditions: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (user_id) {
            conditions.push(`a.user_id = $${idx++}`);
            values.push(user_id);
        }

        if (department) {
            conditions.push(`t.department_label = $${idx++}`);
            values.push(department);
        }

        if (action_type) {
            conditions.push(`a.action_type = $${idx++}`);
            values.push(action_type);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        // Task activities
        let query = `
            SELECT 
                a.id, a.task_id, a.user_id, a.action_type, a.details, a.created_at,
                u.display_name as user_name, u.avatar_url,
                t.title as task_title, t.department_label,
                'task' as source_type
            FROM activity_log a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN tasks t ON a.task_id = t.id
            ${whereClause}
        `;

        // For admin, also include payment activities
        let paymentQuery = '';
        if (isAdmin && !department) {
            paymentQuery = `
                UNION ALL
                SELECT 
                    pa.id, pa.payment_id as task_id, pa.user_id, pa.action_type, pa.details, pa.created_at,
                    u.display_name as user_name, u.avatar_url,
                    p.title as task_title, NULL as department_label,
                    'payment' as source_type
                FROM payment_activity_log pa
                JOIN users u ON pa.user_id = u.id
                LEFT JOIN payments p ON pa.payment_id = p.id
                WHERE p.deleted_at IS NULL
                ${user_id ? `AND pa.user_id = $1` : ''}
                ${action_type && user_id ? `AND pa.action_type = $2` : action_type ? `AND pa.action_type = $1` : ''}
            `;
        }

        const finalQuery = `
            SELECT * FROM (
                ${query}
                ${paymentQuery}
            ) combined
            ORDER BY created_at DESC
            LIMIT $${idx++} OFFSET $${idx++}
        `;

        values.push(parseInt(limit as string, 10), offset);

        const { rows } = await pool.query(finalQuery, values);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                SELECT a.id FROM activity_log a
                LEFT JOIN tasks t ON a.task_id = t.id
                ${whereClause}
                ${isAdmin && !department ? `
                    UNION ALL
                    SELECT pa.id FROM payment_activity_log pa
                    ${user_id ? `WHERE pa.user_id = $1` : ''}
                ` : ''}
            ) c
        `;
        const { rows: [{ total }] } = await pool.query(countQuery, values.slice(0, -2));

        res.json({ items: rows, total: parseInt(total, 10), page: parseInt(page as string, 10) });
    } catch (err) {
        console.error('Activity feed error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea fluxului de activitate.' });
    }
});

export default router;
