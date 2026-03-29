import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/activity-feed — global activity feed with filters and pagination
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
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

        // Build task activity query with its own params
        const taskConditions: string[] = [];
        const allParams: any[] = [];
        let idx = 1;

        if (user_id) {
            taskConditions.push(`a.user_id = $${idx++}`);
            allParams.push(user_id);
        }
        if (department) {
            taskConditions.push(`t.department_label = $${idx++}`);
            allParams.push(department);
        }
        if (action_type) {
            taskConditions.push(`a.action_type = $${idx++}`);
            allParams.push(action_type);
        }

        const taskWhere = taskConditions.length > 0 ? 'WHERE ' + taskConditions.join(' AND ') : '';

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

        // Payment activity (admin only, no department filter)
        let unionQuery: string;

        if (isAdmin && !department) {
            // Build payment query with its OWN parameter indices that reuse
            // the same allParams array but track position correctly via indexOf-free logic
            const payConditions: string[] = ['p.deleted_at IS NULL'];
            if (user_id) {
                // Find or add user_id param
                let paramPos = allParams.indexOf(user_id as string);
                if (paramPos === -1) {
                    allParams.push(user_id as string);
                    paramPos = allParams.length - 1;
                }
                payConditions.push(`pa.user_id = $${paramPos + 1}`);
            }
            if (action_type) {
                // Always add a new param entry for action_type to avoid indexOf collision
                allParams.push(action_type as string);
                payConditions.push(`pa.action_type = $${allParams.length}`);
            }
            const payWhere = 'WHERE ' + payConditions.join(' AND ');
            idx = allParams.length + 1;

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

        // LIMIT/OFFSET with clean index tracking
        const limitIdx = idx++;
        const offsetIdx = idx++;
        allParams.push(limitNum, offset);

        const dataQuery = `
            SELECT * FROM (${unionQuery}) AS combined
            ORDER BY created_at DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;

        const countQuery = `
            SELECT COUNT(*) AS total FROM (${unionQuery}) AS combined
        `;

        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, allParams),
            pool.query(countQuery, allParams.slice(0, -2))
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
}));

export default router;
