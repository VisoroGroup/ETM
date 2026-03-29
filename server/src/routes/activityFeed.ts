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

        const isAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
        const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 100);
        const offset = (pageNum - 1) * limitNum;

        // Build shared parameter list
        const params: any[] = [];
        let idx = 1;

        // --- Task activity conditions ---
        const taskConditions: string[] = [];
        if (user_id) {
            taskConditions.push(`a.user_id = $${idx}`);
            // We'll reuse the same param index for both queries if applicable
        }
        if (department) {
            taskConditions.push(`t.department_label = $${idx + (user_id ? 1 : 0)}`);
        }
        if (action_type) {
            const actionIdx = idx + (user_id ? 1 : 0) + (department ? 1 : 0);
            taskConditions.push(`a.action_type = $${actionIdx}`);
        }

        // For consistent param indexing across UNION, build params once
        if (user_id) { params.push(user_id); idx++; }
        if (department) { params.push(department); idx++; }
        if (action_type) { params.push(action_type); idx++; }

        const taskWhere = taskConditions.length > 0 ? 'WHERE ' + taskConditions.join(' AND ') : '';

        // Task activity SELECT
        const taskSelect = `
            SELECT 
                a.id, a.task_id, a.user_id, a.action_type, a.details, a.created_at,
                u.display_name AS user_name, u.avatar_url,
                t.title AS task_title, t.department_label,
                'task' AS source_type
            FROM activity_log a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN tasks t ON a.task_id = t.id
            ${taskWhere}
        `;

        // --- Payment activity (admin only, no department filter) ---
        let unionQuery: string;

        if (isAdmin && !department) {
            const payConditions: string[] = ['p.deleted_at IS NULL'];
            if (user_id) payConditions.push(`pa.user_id = $1`);
            if (action_type) {
                const actionParamIdx = user_id ? 2 : 1;
                // action_type param is already in params at that index
                // but we need to map it correctly
                const atIdx = params.indexOf(action_type as string) + 1;
                payConditions.push(`pa.action_type = $${atIdx}`);
            }
            const payWhere = 'WHERE ' + payConditions.join(' AND ');

            const paySelect = `
                SELECT 
                    pa.id, pa.payment_id AS task_id, pa.user_id, pa.action_type, pa.details, pa.created_at,
                    u.display_name AS user_name, u.avatar_url,
                    p.title AS task_title, NULL::text AS department_label,
                    'payment' AS source_type
                FROM payment_activity_log pa
                JOIN users u ON pa.user_id = u.id
                LEFT JOIN payments p ON pa.payment_id = p.id
                ${payWhere}
            `;

            unionQuery = `(${taskSelect}) UNION ALL (${paySelect})`;
        } else {
            unionQuery = taskSelect;
        }

        // Add LIMIT/OFFSET params
        const limitIdx = idx++;
        const offsetIdx = idx;
        params.push(limitNum, offset);

        // Final paginated query
        const dataQuery = `
            SELECT * FROM (${unionQuery}) AS combined
            ORDER BY created_at DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;

        const countQuery = `
            SELECT COUNT(*) AS total FROM (${unionQuery}) AS combined
        `;

        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, params),
            pool.query(countQuery, params.slice(0, -2)) // count doesn't use LIMIT/OFFSET
        ]);

        res.json({
            items: dataResult.rows,
            total: parseInt(countResult.rows[0].total, 10),
            page: pageNum
        });
    } catch (err) {
        console.error('Activity feed error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea fluxului de activitate.' });
    }
});

export default router;
