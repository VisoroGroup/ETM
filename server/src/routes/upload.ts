import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { tError } from '../utils/serverErrors';

const router = Router();

// Allowed file types for upload
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/html'
];

const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.ppt', '.pptx',
    '.txt', '.csv', '.html', '.htm'
];

// Use memory storage — we store in PostgreSQL, not filesystem
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // 10MB default
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
            res.status(400).json({ error: tError(req, 'file_required') });
            return;
        }

        const companyId = req.activeCompanyId;
        if (companyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }

        // Check task exists in this company
        const { rows: taskRows } = await pool.query(
            'SELECT id, company_id FROM tasks WHERE id = $1 AND company_id = $2',
            [taskId, companyId]
        );
        if (taskRows.length === 0) {
            res.status(404).json({ error: tError(req, 'task_not_yours') });
            return;
        }
        const taskCompanyId = taskRows[0].company_id;

        // Check task access
        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role, req.activeCompanyId)) {
            res.status(403).json({ error: tError(req, 'task_no_permission') });
            return;
        }

        // Transaction: INSERT attachment → set file_url → activity log
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert attachment with binary data
            const { rows } = await client.query(
                `INSERT INTO task_attachments (task_id, file_name, file_url, file_size, file_data, file_mime, uploaded_by, company_id)
                 VALUES ($1, $2, '', $3, $4, $5, $6, $7) RETURNING id, task_id, file_name, file_url, file_size, uploaded_by, created_at`,
                [taskId, file.originalname, file.size, file.buffer, file.mimetype, req.user!.id, taskCompanyId]
            );

            // Set file_url using the generated ID
            const attachmentId = rows[0].id;
            const fileUrl = `/api/files/attachment/${attachmentId}`;
            await client.query('UPDATE task_attachments SET file_url = $1 WHERE id = $2', [fileUrl, attachmentId]);
            rows[0].file_url = fileUrl;

            // Activity log
            await client.query(
                `INSERT INTO activity_log (task_id, user_id, action_type, details, company_id)
                 VALUES ($1, $2, 'attachment_added', $3, $4)`,
                [taskId, req.user!.id, JSON.stringify({
                    file_name: file.originalname,
                    file_size: file.size
                }), taskCompanyId]
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
        res.status(500).json({ error: tError(req, 'file_upload_error') });
    }
});

// POST /api/upload/project/:projectId — upload file to a PUG project.
// Same multer pipeline (size limits, mime whitelist) as task upload.
router.post('/project/:projectId', authMiddleware, (req: AuthRequest, res: Response, next) => {
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
        const { projectId } = req.params;
        const file = req.file;
        const companyId = req.activeCompanyId;
        // Optional geo metadata captured by the browser before upload — sent
        // as plain form fields alongside the file. Parsed defensively; an
        // invalid lat/lng is silently dropped rather than rejecting the upload.
        const parseNum = (v: any): number | null => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };
        const geoLat = parseNum(req.body?.geo_lat);
        const geoLng = parseNum(req.body?.geo_lng);
        const geoAcc = parseNum(req.body?.geo_accuracy);
        const capturedAtRaw = req.body?.captured_at;
        const capturedAt = (typeof capturedAtRaw === 'string' && !Number.isNaN(Date.parse(capturedAtRaw)))
            ? capturedAtRaw : null;
        if (!file) {
            res.status(400).json({ error: tError(req, 'file_required') });
            return;
        }
        if (companyId === undefined) {
            res.status(400).json({ error: tError(req, 'company_missing') });
            return;
        }

        // Tenant guard.
        const { rows: pcheck } = await pool.query(
            `SELECT 1 FROM pug_projects WHERE id = $1 AND company_id = $2`,
            [projectId, companyId]
        );
        if (pcheck.length === 0) {
            res.status(404).json({ error: tError(req, 'pug_project_not_found') });
            return;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `INSERT INTO pug_project_attachments
                    (pug_project_id, file_name, file_url, file_size, file_data, file_mime, uploaded_by, company_id,
                     geo_lat, geo_lng, geo_accuracy, captured_at)
                 VALUES ($1, $2, '', $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id, pug_project_id, file_name, file_url, file_size, uploaded_by, created_at,
                           geo_lat, geo_lng, geo_accuracy, captured_at`,
                [projectId, file.originalname, file.size, file.buffer, file.mimetype, req.user!.id, companyId,
                 geoLat, geoLng, geoAcc, capturedAt]
            );
            const attachmentId = rows[0].id;
            const fileUrl = `/api/files/project-attachment/${attachmentId}`;
            await client.query(
                `UPDATE pug_project_attachments SET file_url = $1 WHERE id = $2`,
                [fileUrl, attachmentId]
            );
            rows[0].file_url = fileUrl;
            await client.query('COMMIT');
            rows[0].uploaded_by_name = req.user!.display_name;
            res.status(201).json(rows[0]);
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error uploading project file:', err);
        res.status(500).json({ error: tError(req, 'file_upload_error') });
    }
});

export default router;
