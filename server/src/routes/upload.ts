import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    }
});

// POST /api/upload/:taskId — upload file to task
router.post('/:taskId', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: 'Fișierul este obligatoriu.' });
            return;
        }

        // Check task exists
        const { rows: taskRows } = await pool.query('SELECT id FROM tasks WHERE id = $1', [taskId]);
        if (taskRows.length === 0) {
            // Clean up uploaded file
            fs.unlinkSync(file.path);
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        const fileUrl = `/uploads/${file.filename}`;

        const { rows } = await pool.query(
            `INSERT INTO task_attachments (task_id, file_name, file_url, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [taskId, file.originalname, fileUrl, file.size, req.user!.id]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'attachment_added', $3)`,
            [taskId, req.user!.id, JSON.stringify({
                file_name: file.originalname,
                file_size: file.size
            })]
        );

        rows[0].uploader_name = req.user!.display_name;
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: 'Eroare la încărcarea fișierului.' });
    }
});

export default router;
