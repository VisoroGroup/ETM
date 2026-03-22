import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = Router();

const MONTH_NAMES = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

// GET /api/reports/monthly?month=2026-03&format=pdf&sections=tasks,departments,users,payments
router.get('/monthly', authMiddleware, requireRole('admin', 'manager'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { month, format = 'pdf', sections: sectionsStr = 'tasks,departments,users,payments' } = req.query as any;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ error: 'Parametrul month este obligatoriu (format: YYYY-MM).' });
        return;
    }

    const sections = (sectionsStr as string).split(',');
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 1);
    const monthName = MONTH_NAMES[m - 1];

    // Task summary
    const { rows: [taskSummary] } = await pool.query(`
        SELECT
            COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) AS created,
            COUNT(*) FILTER (WHERE status = 'terminat' AND updated_at >= $1 AND updated_at < $2) AS completed,
            COUNT(*) FILTER (WHERE due_date < $2 AND status != 'terminat' AND deleted_at IS NULL) AS overdue,
            COUNT(*) FILTER (WHERE status = 'blocat' AND deleted_at IS NULL) AS blocked
        FROM tasks WHERE deleted_at IS NULL
    `, [startDate, endDate]);

    // Department breakdown
    const { rows: deptBreakdown } = await pool.query(`
        SELECT department_label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'terminat') AS completed,
            COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'terminat') AS overdue
        FROM tasks
        WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2
        GROUP BY department_label ORDER BY department_label
    `, [startDate, endDate]);

    // User breakdown
    const { rows: userBreakdown } = await pool.query(`
        SELECT u.display_name,
            COUNT(t.id) FILTER (WHERE t.status = 'terminat' AND t.updated_at >= $1 AND t.updated_at < $2) AS completed,
            COUNT(t.id) FILTER (WHERE t.due_date < $2 AND t.status != 'terminat') AS overdue,
            COUNT(t.id) AS total_assigned
        FROM users u
        LEFT JOIN tasks t ON t.assigned_to = u.id AND t.deleted_at IS NULL
        WHERE u.is_active = true
        GROUP BY u.id, u.display_name
        HAVING COUNT(t.id) > 0
        ORDER BY completed DESC
    `, [startDate, endDate]);

    // Payment summary
    let paymentSummary = null;
    if (sections.includes('payments') && req.user!.role === 'admin') {
        const { rows: [ps] } = await pool.query(`
            SELECT
                COALESCE(SUM(amount) FILTER (WHERE status = 'platit' AND paid_at >= $1 AND paid_at < $2), 0) AS paid,
                COALESCE(SUM(amount) FILTER (WHERE status = 'de_platit' AND due_date >= $1 AND due_date < $2), 0) AS to_pay,
                COALESCE(SUM(amount) FILTER (WHERE status = 'de_platit' AND due_date < $1), 0) AS overdue_amount
            FROM payments WHERE deleted_at IS NULL
        `, [startDate, endDate]);
        paymentSummary = ps;
    }

    if (format === 'excel') {
        await generateExcel(res, { monthName, year, taskSummary, deptBreakdown, userBreakdown, paymentSummary, sections, month });
    } else {
        await generatePDF(res, { monthName, year, taskSummary, deptBreakdown, userBreakdown, paymentSummary, sections, month });
    }
}));

interface ReportData {
    monthName: string; year: number;
    taskSummary: any; deptBreakdown: any[]; userBreakdown: any[];
    paymentSummary: any | null; sections: string[]; month: string;
}

async function generatePDF(res: Response, data: ReportData) {
    const { monthName, year, taskSummary, deptBreakdown, userBreakdown, paymentSummary, sections, month } = data;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=raport_${month}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('ETM — Raport lunar', { align: 'center' });
    doc.fontSize(16).font('Helvetica').text(`${monthName} ${year}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#888').text(`Generat la: ${new Date().toLocaleDateString('ro-RO')}`, { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(1.5);

    // Task Summary
    if (sections.includes('tasks')) {
        doc.fontSize(14).font('Helvetica-Bold').text('Sumar sarcini');
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        const stats = [
            ['Create în această lună', taskSummary.created],
            ['Completate în această lună', taskSummary.completed],
            ['Restante', taskSummary.overdue],
            ['Blocate', taskSummary.blocked],
        ];
        for (const [label, value] of stats) {
            doc.fontSize(11).font('Helvetica').text(`${label}: `, { continued: true });
            doc.font('Helvetica-Bold').text(String(value));
        }
        doc.moveDown(1);
    }

    // Department breakdown
    if (sections.includes('departments') && deptBreakdown.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Detalii pe departamente');
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        // Table header
        const cols = [50, 200, 300, 380, 460];
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Departament', cols[0], doc.y, { width: 140 });
        doc.text('Total', cols[1], doc.y, { width: 80 });
        doc.text('Completate', cols[2], doc.y, { width: 80 });
        doc.text('Restante', cols[3], doc.y, { width: 80 });
        doc.moveDown(0.3);
        drawLine(doc);
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(10);
        for (const dept of deptBreakdown) {
            const y = doc.y;
            doc.text(dept.department_label || '—', cols[0], y, { width: 140 });
            doc.text(String(dept.total), cols[1], y, { width: 80 });
            doc.text(String(dept.completed), cols[2], y, { width: 80 });
            doc.text(String(dept.overdue), cols[3], y, { width: 80 });
            doc.moveDown(0.5);
        }
        doc.moveDown(1);
    }

    // User breakdown
    if (sections.includes('users') && userBreakdown.length > 0) {
        if (doc.y > 650) doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('Detalii pe utilizatori');
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        const cols = [50, 220, 310, 400];
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Utilizator', cols[0], doc.y, { width: 160 });
        doc.text('Completate', cols[1], doc.y, { width: 80 });
        doc.text('Restante', cols[2], doc.y, { width: 80 });
        doc.text('Total asignate', cols[3], doc.y, { width: 100 });
        doc.moveDown(0.3);
        drawLine(doc);
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(10);
        for (const u of userBreakdown) {
            if (doc.y > 720) doc.addPage();
            const y = doc.y;
            doc.text(u.display_name, cols[0], y, { width: 160 });
            doc.text(String(u.completed), cols[1], y, { width: 80 });
            doc.text(String(u.overdue), cols[2], y, { width: 80 });
            doc.text(String(u.total_assigned), cols[3], y, { width: 100 });
            doc.moveDown(0.5);
        }
        doc.moveDown(1);
    }

    // Payment summary
    if (sections.includes('payments') && paymentSummary) {
        if (doc.y > 650) doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('Sumar plăți');
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        doc.fontSize(11).font('Helvetica');
        doc.text(`Plătit în ${monthName}: `, { continued: true });
        doc.font('Helvetica-Bold').text(`${Number(paymentSummary.paid).toLocaleString('ro-RO')} RON`);
        doc.font('Helvetica').text(`De plătit în ${monthName}: `, { continued: true });
        doc.font('Helvetica-Bold').text(`${Number(paymentSummary.to_pay).toLocaleString('ro-RO')} RON`);
        doc.font('Helvetica').text('Restanțe: ', { continued: true });
        doc.font('Helvetica-Bold').fillColor('#cc0000').text(`${Number(paymentSummary.overdue_amount).toLocaleString('ro-RO')} RON`);
        doc.fillColor('#000');
    }

    doc.end();
}

function drawLine(doc: PDFKit.PDFDocument) {
    doc.strokeColor('#cccccc').lineWidth(0.5)
       .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
}

async function generateExcel(res: Response, data: ReportData) {
    const { monthName, year, taskSummary, deptBreakdown, userBreakdown, paymentSummary, sections, month } = data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ETM';
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
        alignment: { horizontal: 'center' },
    };

    // Sheet 1: Sumar
    if (sections.includes('tasks')) {
        const ws = workbook.addWorksheet('Sumar');
        ws.columns = [{ width: 35 }, { width: 15 }];
        ws.addRow([`Raport lunar — ${monthName} ${year}`]).font = { bold: true, size: 14 };
        ws.addRow([]);
        const h = ws.addRow(['Indicator', 'Valoare']);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        ws.addRow(['Create în această lună', Number(taskSummary.created)]);
        ws.addRow(['Completate în această lună', Number(taskSummary.completed)]);
        ws.addRow(['Restante', Number(taskSummary.overdue)]);
        ws.addRow(['Blocate', Number(taskSummary.blocked)]);
    }

    // Sheet 2: Departamente
    if (sections.includes('departments') && deptBreakdown.length > 0) {
        const ws = workbook.addWorksheet('Departamente');
        ws.columns = [{ width: 25 }, { width: 12 }, { width: 14 }, { width: 12 }];
        const h = ws.addRow(['Departament', 'Total', 'Completate', 'Restante']);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        for (const d of deptBreakdown) {
            ws.addRow([d.department_label || '—', Number(d.total), Number(d.completed), Number(d.overdue)]);
        }
    }

    // Sheet 3: Utilizatori
    if (sections.includes('users') && userBreakdown.length > 0) {
        const ws = workbook.addWorksheet('Utilizatori');
        ws.columns = [{ width: 25 }, { width: 14 }, { width: 12 }, { width: 16 }];
        const h = ws.addRow(['Utilizator', 'Completate', 'Restante', 'Total asignate']);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        for (const u of userBreakdown) {
            ws.addRow([u.display_name, Number(u.completed), Number(u.overdue), Number(u.total_assigned)]);
        }
    }

    // Sheet 4: Plăți
    if (sections.includes('payments') && paymentSummary) {
        const ws = workbook.addWorksheet('Plăți');
        ws.columns = [{ width: 30 }, { width: 18 }];
        const h = ws.addRow(['Indicator', 'Sumă (RON)']);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        ws.addRow([`Plătit în ${monthName}`, Number(paymentSummary.paid)]);
        ws.addRow([`De plătit în ${monthName}`, Number(paymentSummary.to_pay)]);
        ws.addRow(['Restanțe', Number(paymentSummary.overdue_amount)]);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=raport_${month}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
}

export default router;
