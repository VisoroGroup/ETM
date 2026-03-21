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
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        // --- Task activities query (separate parameter tracking) ---
        const taskConditions: string[] = [];
        const taskValues: any[] = [];
        let taskIdx = 1;

        if (user_id) {
            taskConditions.push(`a.user_id = $${taskIdx++}`);
            taskValues.push(user_id);
        }
        if (department) {
            taskConditions.push(`t.department_label = $${taskIdx++}`);
            taskValues.push(department);
        }
        if (action_type) {
            taskConditions.push(`a.action_type = $${taskIdx++}`);
            taskValues.push(action_type);
        }

        const taskWhere = taskConditions.length > 0 ? 'WHERE ' + taskConditions.join(' AND ') : '';

        const taskQuery = `
            SELECT 
                a.id, a.task_id, a.user_id, a.action_type, a.details, a.created_at,
                u.display_name as user_name, u.avatar_url,
                t.title as task_title, t.department_label,
                'task' as source_type
            FROM activity_log a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN tasks t ON a.task_id = t.id
            ${taskWhere}
        `;

        const [taskResult, taskCountResult] = await Promise.all([
            pool.query(taskQuery, taskValues),
            pool.query(
                `SELECT COUNT(*) as total FROM activity_log a LEFT JOIN tasks t ON a.task_id = t.id ${taskWhere}`,
                taskValues
            )
        ]);

        let allItems = taskResult.rows;
        let totalCount = parseInt(taskCountResult.rows[0].total, 10);

        // --- Payment activities query (admin only, no department filter) ---
        if (isAdmin && !department) {
            const payConditions: string[] = ['p.deleted_at IS NULL'];
            const payValues: any[] = [];
            let payIdx = 1;

            if (user_id) {
                payConditions.push(`pa.user_id = $${payIdx++}`);
                payValues.push(user_id);
            }
            if (action_type) {
                payConditions.push(`pa.action_type = $${payIdx++}`);
                payValues.push(action_type);
            }

            const payWhere = 'WHERE ' + payConditions.join(' AND ');

            const payQuery = `
                SELECT 
                    pa.id, pa.payment_id as task_id, pa.user_id, pa.action_type, pa.details, pa.created_at,
                    u.display_name as user_name, u.avatar_url,
                    p.title as task_title, NULL as department_label,
                    'payment' as source_type
                FROM payment_activity_log pa
                JOIN users u ON pa.user_id = u.id
                LEFT JOIN payments p ON pa.payment_id = p.id
                ${payWhere}
            `;

            const [payResult, payCountResult] = await Promise.all([
                pool.query(payQuery, payValues),
                pool.query(
                    `SELECT COUNT(*) as total FROM payment_activity_log pa LEFT JOIN payments p ON pa.payment_id = p.id ${payWhere}`,
                    payValues
                )
            ]);

            allItems = [...allItems, ...payResult.rows];
            totalCount += parseInt(payCountResult.rows[0].total, 10);
        }

        // Sort combined results by created_at DESC and apply pagination in JS
        allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const paginatedItems = allItems.slice(offset, offset + limitNum);

        res.json({ items: paginatedItems, total: totalCount, page: pageNum });
    } catch (err) {
        console.error('Activity feed error:', err);
        res.status(500).json({ error: 'Eroare la încărcarea fluxului de activitate.' });
    }
});

export default router;
