import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Allowed file types for upload
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
];

const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.csv'
];

// Use memory storage — we store in PostgreSQL, not filesystem
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Nem engedélyezett fájltípus: ${file.mimetype} (${ext})`));
        }
    }
});

// POST /api/upload/:taskId — upload file to task (stored in PostgreSQL)
router.post('/:taskId', authMiddleware, (req: AuthRequest, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Eroare la upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req: AuthRequest, res: Response): Promise<void> => {
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
            res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
            return;
        }

        // Transaction: INSERT attachment → set file_url → activity log
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert attachment with binary data
            const { rows } = await client.query(
                `INSERT INTO task_attachments (task_id, file_name, file_url, file_size, file_data, file_mime, uploaded_by)
                 VALUES ($1, $2, '', $3, $4, $5, $6) RETURNING id, task_id, file_name, file_url, file_size, uploaded_by, created_at`,
                [taskId, file.originalname, file.size, file.buffer, file.mimetype, req.user!.id]
            );

            // Set file_url using the generated ID
            const attachmentId = rows[0].id;
            const fileUrl = `/api/files/attachment/${attachmentId}`;
            await client.query('UPDATE task_attachments SET file_url = $1 WHERE id = $2', [fileUrl, attachmentId]);
            rows[0].file_url = fileUrl;

            // Activity log
            await client.query(
                `INSERT INTO activity_log (task_id, user_id, action_type, details)
                 VALUES ($1, $2, 'attachment_added', $3)`,
                [taskId, req.user!.id, JSON.stringify({
                    file_name: file.originalname,
                    file_size: file.size
                })]
            );

            await client.query('COMMIT');

            rows[0].uploader_name = req.user!.display_name;
            res.status(201).json(rows[0]);
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: 'Eroare la încărcarea fișierului.' });
    }
});

export default router;
