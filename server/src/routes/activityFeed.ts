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
                a.id, a.task_id, a.user_id,
                a.action_type::text AS action_type,
                a.details, a.created_at,
                u.display_name AS user_name, u.avatar_url,
                t.title AS task_title,
                t.department_label::text AS department_label,
                'task' AS source_type
            FROM activity_log a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN tasks t ON a.task_id = t.id
            ${taskWhere}
        `;

        const unionQuery = taskSelect;

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
