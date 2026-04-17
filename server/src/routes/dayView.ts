import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import PDFDocument from 'pdfkit';

const router = Router();

const STATUS_LABELS: Record<string, string> = {
    de_rezolvat: 'De rezolvat',
    in_realizare: 'În realizare',
    terminat: 'Terminat',
    blocat: 'Blocat',
};

const DEPT_LABELS: Record<string, string> = {
    departament_1: 'Comunicare si HR',
    departament_2: 'Vanzari',
    departament_3: 'Financiar',
    departament_4: 'Productie',
    departament_5: 'Calitate',
    departament_6: 'Extindere',
    departament_7: 'Administrativ',
};

interface DayViewTask {
    id: string;
    title: string;
    status: string;
    due_date: string;
    description: string | null;
    department_label: string;
    subtasks: { title: string; is_completed: boolean; due_date: string | null }[];
}

interface DayViewUser {
    id: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
    tasks: DayViewTask[];
}

// GET /api/day-view/week?start=YYYY-MM-DD — 7 days starting at `start`
// Returns { days: [{ date, users: [...] }, ...] } where each day uses the same
// shape as /day-view so the client can re-use renderers.
router.get('/week', authMiddleware, requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const startStr = (req.query.start as string) || new Date().toISOString().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
        res.status(400).json({ error: 'Format dată invalid. Folosește YYYY-MM-DD.' });
        return;
    }

    // Build 7 dates starting at `start`. We stay in local time the whole way —
    // splitting on toISOString() would convert to UTC first and, on servers east
    // of UTC, shift each day by one. Since the input is already YYYY-MM-DD, we
    // just increment the date component and format it back.
    const dates: string[] = [];
    const [startY, startM, startD] = startStr.split('-').map(Number);
    for (let i = 0; i < 7; i++) {
        const d = new Date(startY, startM - 1, startD + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${dd}`);
    }

    // Query each day in parallel
    const days = await Promise.all(
        dates.map(async (date) => ({ date, users: await getDayViewData(date) }))
    );

    res.json({ start: dates[0], end: dates[dates.length - 1], days });
}));

// GET /api/day-view?date=YYYY-MM-DD
router.get('/', authMiddleware, requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Format dată invalid. Folosește YYYY-MM-DD.' });
        return;
    }

    const users = await getDayViewData(date);
    res.json({ date, users });
}));

// GET /api/day-view/pdf/:userId?date=YYYY-MM-DD
router.get('/pdf/:userId', authMiddleware, requireRole('superadmin'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Format dată invalid.' });
        return;
    }

    // Get single user data
    const allUsers = await getDayViewData(date);
    const userData = allUsers.find(u => u.id === userId);

    if (!userData) {
        res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
        return;
    }

    await generateDayViewPDF(res, userData, date);
}));

async function getDayViewData(date: string): Promise<DayViewUser[]> {
    // Batch query 1: all active users
    const { rows: users } = await pool.query(
        `SELECT id, display_name, email, avatar_url FROM users WHERE is_active = true ORDER BY display_name`
    );

    // Batch query 2: all tasks due on this date (with assigned user)
    const { rows: allTasks } = await pool.query(`
        SELECT t.id, t.title, t.status, t.due_date, t.description, t.department_label, t.assigned_to,
               EXISTS (SELECT 1 FROM recurring_tasks rt WHERE rt.template_task_id = t.id AND rt.is_active = true) AS is_recurring
        FROM tasks t
        WHERE t.deleted_at IS NULL
          AND t.status != 'terminat'
          AND t.due_date::date = $1::date
        ORDER BY
            CASE t.status
                WHEN 'blocat' THEN 1
                WHEN 'in_realizare' THEN 2
                WHEN 'de_rezolvat' THEN 3
            END,
            t.due_date ASC
    `, [date]);

    // Batch query 3: all subtask-based tasks for this date (user has subtask due, but task not directly assigned)
    const { rows: subtaskTasks } = await pool.query(`
        SELECT DISTINCT t.id, t.title, t.status, t.due_date, t.description, t.department_label,
               s.assigned_to,
               EXISTS (SELECT 1 FROM recurring_tasks rt WHERE rt.template_task_id = t.id AND rt.is_active = true) AS is_recurring
        FROM tasks t
        JOIN subtasks s ON s.task_id = t.id
        WHERE t.deleted_at IS NULL
          AND t.status != 'terminat'
          AND s.is_completed = false
          AND s.due_date::date = $1::date
          AND s.deleted_at IS NULL
        ORDER BY t.title
    `, [date]);

    // Batch query 4: all subtasks for relevant task IDs
    const allTaskIds = new Set([...allTasks.map(t => t.id), ...subtaskTasks.map(t => t.id)]);
    const subtaskMap = new Map<string, any[]>();
    if (allTaskIds.size > 0) {
        const { rows: subtasks } = await pool.query(`
            SELECT task_id, title, is_completed, due_date
            FROM subtasks
            WHERE task_id = ANY($1::uuid[]) AND deleted_at IS NULL
            ORDER BY order_index
        `, [Array.from(allTaskIds)]);
        for (const s of subtasks) {
            if (!subtaskMap.has(s.task_id)) subtaskMap.set(s.task_id, []);
            subtaskMap.get(s.task_id)!.push(s);
        }
    }

    // Group tasks by user
    const userTaskMap = new Map<string, any[]>();
    const directTaskIdsByUser = new Map<string, Set<string>>();

    for (const task of allTasks) {
        if (!task.assigned_to) continue;
        if (!userTaskMap.has(task.assigned_to)) userTaskMap.set(task.assigned_to, []);
        if (!directTaskIdsByUser.has(task.assigned_to)) directTaskIdsByUser.set(task.assigned_to, new Set());
        const t = { ...task, subtasks: subtaskMap.get(task.id) || [] };
        userTaskMap.get(task.assigned_to)!.push(t);
        directTaskIdsByUser.get(task.assigned_to)!.add(task.id);
    }

    // Add subtask-based tasks (only if not already direct-assigned)
    for (const task of subtaskTasks) {
        if (!task.assigned_to) continue;
        const directIds = directTaskIdsByUser.get(task.assigned_to);
        if (directIds && directIds.has(task.id)) continue;
        if (!userTaskMap.has(task.assigned_to)) userTaskMap.set(task.assigned_to, []);
        const t = { ...task, subtasks: subtaskMap.get(task.id) || [] };
        userTaskMap.get(task.assigned_to)!.push(t);
    }

    // Build result
    return users.map(user => ({
        id: user.id,
        display_name: user.display_name,
        email: user.email,
        avatar_url: user.avatar_url,
        tasks: userTaskMap.get(user.id) || [],
    }));
}

async function generateDayViewPDF(res: Response, userData: DayViewUser, date: string) {
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = isNaN(dateObj.getTime())
        ? date
        : dateObj.toLocaleDateString('ro-RO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
        `attachment; filename=${encodeURIComponent(userData.display_name)}_tasks_${date}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // === HEADER ===
    // Navy background strip
    doc.rect(0, 0, 595.28, 100).fill('#102a43');

    // Company name
    doc.fontSize(10).font('Helvetica').fillColor('#829ab1')
        .text('VISORO GLOBAL SRL', 50, 25, { align: 'left' });

    // Title
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff')
        .text(`Sarcini zilnice`, 50, 45, { align: 'left' });

    // User name & date on the right
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#60A5FA')
        .text(userData.display_name, 50, 30, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#9fb3c8')
        .text(formattedDate, 50, 48, { align: 'right' });

    // Blue accent line
    doc.rect(50, 90, 495.28, 2).fill('#3B82F6');

    doc.fillColor('#000000');
    doc.y = 115;

    if (userData.tasks.length === 0) {
        doc.fontSize(13).font('Helvetica').fillColor('#627d98')
            .text('Nicio sarcină programată pentru această zi.', 50, 140, { align: 'center' });
    } else {
        // Task count summary
        doc.fontSize(10).font('Helvetica').fillColor('#627d98')
            .text(`Total sarcini: ${userData.tasks.length}`, 50, doc.y);
        doc.moveDown(1);

        for (let i = 0; i < userData.tasks.length; i++) {
            const task = userData.tasks[i];

            // Page break check
            if (doc.y > 700) doc.addPage();

            // Task number + title
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#102a43')
                .text(`${i + 1}. ${task.title}`, 50, doc.y, { width: 495 });
            doc.moveDown(0.3);

            // Status + Department + Due date row
            const statusLabel = STATUS_LABELS[task.status] || task.status;
            const deptLabel = DEPT_LABELS[task.department_label] || task.department_label;
            const dueDateObj = new Date(task.due_date + 'T00:00:00');
            const dueDate = isNaN(dueDateObj.getTime()) ? task.due_date : dueDateObj.toLocaleDateString('ro-RO');

            doc.fontSize(9).font('Helvetica').fillColor('#486581')
                .text(`Status: ${statusLabel}  •  Departament: ${deptLabel}  •  Termen: ${dueDate}`, 65, doc.y);
            doc.moveDown(0.3);

            // Description
            if (task.description) {
                const desc = task.description.length > 200
                    ? task.description.substring(0, 200) + '...'
                    : task.description;
                doc.fontSize(9).font('Helvetica').fillColor('#334e68')
                    .text(desc, 65, doc.y, { width: 470 });
                doc.moveDown(0.3);
            }

            // Subtasks
            if (task.subtasks.length > 0) {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#486581')
                    .text(`Subtask-uri (${task.subtasks.filter(s => s.is_completed).length}/${task.subtasks.length}):`, 65, doc.y);
                doc.moveDown(0.2);

                for (const sub of task.subtasks) {
                    if (doc.y > 740) doc.addPage();
                    const check = sub.is_completed ? '☑' : '☐';
                    const color = sub.is_completed ? '#10B981' : '#334e68';
                    doc.fontSize(8.5).font('Helvetica').fillColor(color)
                        .text(`  ${check}  ${sub.title}`, 75, doc.y, { width: 450 });
                    doc.moveDown(0.15);
                }
            }

            // Separator line between tasks
            if (i < userData.tasks.length - 1) {
                doc.moveDown(0.5);
                doc.strokeColor('#d9e2ec').lineWidth(0.5)
                    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(0.5);
            }
        }
    }

    // === FOOTER ===
    const footerY = doc.page.height - 40;
    doc.fontSize(7).font('Helvetica').fillColor('#9fb3c8')
        .text(`Visoro Global SRL — Generat: ${new Date().toLocaleString('ro-RO')}`, 50, footerY, {
            width: 495, align: 'center'
        });

    doc.end();
}

export default router;
