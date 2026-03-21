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

const upload = multer({
    storage,
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

// POST /api/upload/:taskId — upload file to task
router.post('/:taskId', authMiddleware, (req: AuthRequest, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer error (file too large, etc.)
            return res.status(400).json({ error: `Eroare la upload: ${err.message}` });
        } else if (err) {
            // File filter rejection or other error
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
