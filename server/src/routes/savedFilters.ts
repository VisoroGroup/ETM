import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

// GET /api/saved-filters — list user's saved filters
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
        'SELECT * FROM saved_filters WHERE user_id = $1 ORDER BY order_index ASC',
        [req.user!.id]
    );
    res.json(rows);
}));

// POST /api/saved-filters — create a new saved filter (max 10)
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, page = 'tasks', filter_config } = req.body;
    if (!name || !filter_config) {
        res.status(400).json({ error: 'Numele și configurația filtrului sunt obligatorii.' });
        return;
    }

    // Limit config size to prevent abuse
    const configStr = JSON.stringify(filter_config);
    if (configStr.length > 10000) {
        res.status(400).json({ error: 'Filter config too large (max 10KB).' });
        return;
    }

    // Check count limit
    const { rows: [{ count }] } = await pool.query(
        'SELECT COUNT(*)::int as count FROM saved_filters WHERE user_id = $1',
        [req.user!.id]
    );
    if (count >= 10) {
        res.status(400).json({ error: 'Maxim 10 vederi salvate permise.' });
        return;
    }

    const { rows: [filter] } = await pool.query(
        `INSERT INTO saved_filters (user_id, name, page, filter_config, order_index)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user!.id, name, page, JSON.stringify(filter_config), count]
    );
    res.status(201).json(filter);
}));

// DELETE /api/saved-filters/:id — delete a saved filter
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rowCount } = await pool.query(
        'DELETE FROM saved_filters WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user!.id]
    );
    if (rowCount === 0) {
        res.status(404).json({ error: 'Filtru negăsit.' });
        return;
    }
    res.status(204).send();
}));

export default router;
