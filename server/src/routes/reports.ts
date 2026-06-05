import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { tServer, ServerLocale } from '../i18n/serverI18n';

const router = Router();

const DATE_LOCALE: Record<ServerLocale, string> = {
    ro: 'ro-RO',
    hu: 'hu-HU',
    en: 'en-US',
};

function monthName(locale: ServerLocale, monthIndex1Based: number): string {
    return tServer(locale, `report.month_${monthIndex1Based}`);
}

// GET /api/reports/monthly?month=2026-03&format=pdf&sections=tasks,departments,users
// Open to any authenticated company member: requireRole('user') passes every role
// via ROLE_INHERITANCE. The report stays tenant-scoped to req.activeCompanyId below.
router.get('/monthly', authMiddleware, requireRole('user'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.activeCompanyId;

    // Resolve the company language up-front so even validation errors come
    // back in the right language. Default to 'ro' if the company row is
    // missing the column or the column is null.
    let locale: ServerLocale = 'ro';
    if (companyId !== undefined) {
        const { rows } = await pool.query<{ language: string | null }>(
            'SELECT language FROM companies WHERE id = $1',
            [companyId]
        );
        const lang = rows[0]?.language;
        if (lang === 'ro' || lang === 'hu' || lang === 'en') {
            locale = lang;
        }
    }

    if (companyId === undefined) {
        res.status(400).json({ error: tServer(locale, 'report.error_no_active_company') });
        return;
    }

    const { month, format = 'pdf', sections: sectionsStr = 'tasks,departments,users' } = req.query as any;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ error: tServer(locale, 'report.error_month_required') });
        return;
    }

    const validSections = ['tasks', 'departments', 'users'];
    const sections = (sectionsStr as string).split(',').filter((s: string) => validSections.includes(s));
    if (sections.length === 0) {
        res.status(400).json({ error: tServer(locale, 'report.error_invalid_sections') });
        return;
    }
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 1);
    const monthLabel = monthName(locale, m);

    // Task summary
    const { rows: [taskSummary] } = await pool.query(`
        SELECT
            COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) AS created,
            COUNT(*) FILTER (WHERE status = 'terminat' AND updated_at >= $1 AND updated_at < $2) AS completed,
            COUNT(*) FILTER (WHERE due_date < $2 AND status != 'terminat' AND deleted_at IS NULL) AS overdue,
            COUNT(*) FILTER (WHERE status = 'blocat' AND deleted_at IS NULL) AS blocked
        FROM tasks
        WHERE deleted_at IS NULL
          AND company_id = $3
    `, [startDate, endDate, companyId]);

    // Department breakdown
    const { rows: deptBreakdown } = await pool.query(`
        SELECT department_label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'terminat') AS completed,
            COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'terminat') AS overdue
        FROM tasks
        WHERE deleted_at IS NULL
          AND company_id = $3
          AND created_at >= $1 AND created_at < $2
        GROUP BY department_label ORDER BY department_label
    `, [startDate, endDate, companyId]);

    // User breakdown — limited to users that belong to the active company.
    const { rows: userBreakdown } = await pool.query(`
        SELECT u.display_name,
            COUNT(t.id) FILTER (WHERE t.status = 'terminat' AND t.updated_at >= $1 AND t.updated_at < $2) AS completed,
            COUNT(t.id) FILTER (WHERE t.due_date < $2 AND t.status != 'terminat') AS overdue,
            COUNT(t.id) AS total_assigned
        FROM users u
        JOIN user_companies uc ON uc.user_id = u.id AND uc.company_id = $3
        LEFT JOIN tasks t ON t.assigned_to = u.id
            AND t.deleted_at IS NULL
            AND t.company_id = $3
        WHERE u.is_active = true
        GROUP BY u.id, u.display_name
        HAVING COUNT(t.id) > 0
        ORDER BY completed DESC
    `, [startDate, endDate, companyId]);

    if (format === 'excel') {
        await generateExcel(res, { monthLabel, year, taskSummary, deptBreakdown, userBreakdown, sections, month, locale });
    } else {
        await generatePDF(res, { monthLabel, year, taskSummary, deptBreakdown, userBreakdown, sections, month, locale });
    }
}));

interface ReportData {
    monthLabel: string; year: number;
    taskSummary: any; deptBreakdown: any[]; userBreakdown: any[];
    sections: string[]; month: string;
    locale: ServerLocale;
}

async function generatePDF(res: Response, data: ReportData) {
    const { monthLabel, year, taskSummary, deptBreakdown, userBreakdown, sections, month, locale } = data;
    const t = (key: string, vars?: Record<string, string | number>) => tServer(locale, key, vars);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=raport_${month}_${locale}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text(t('report.title'), { align: 'center' });
    doc.fontSize(16).font('Helvetica').text(t('report.month_year', { month: monthLabel, year }), { align: 'center' });
    doc.moveDown(0.5);
    const generatedDate = new Date().toLocaleDateString(DATE_LOCALE[locale]);
    doc.fontSize(9).fillColor('#888').text(t('report.generated_at', { date: generatedDate }), { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(1.5);

    // Task Summary
    if (sections.includes('tasks')) {
        doc.fontSize(14).font('Helvetica-Bold').text(t('report.section_summary'));
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        const stats: Array<[string, any]> = [
            [t('report.stat_created'), taskSummary.created],
            [t('report.stat_completed'), taskSummary.completed],
            [t('report.stat_overdue'), taskSummary.overdue],
            [t('report.stat_blocked'), taskSummary.blocked],
        ];
        for (const [label, value] of stats) {
            doc.fontSize(11).font('Helvetica').text(`${label}: `, { continued: true });
            doc.font('Helvetica-Bold').text(String(value));
        }
        doc.moveDown(1);
    }

    // Department breakdown
    if (sections.includes('departments') && deptBreakdown.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text(t('report.section_departments'));
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        // Table header
        const cols = [50, 200, 300, 380, 460];
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text(t('report.col_department'), cols[0], doc.y, { width: 140 });
        doc.text(t('report.col_total'), cols[1], doc.y, { width: 80 });
        doc.text(t('report.col_completed'), cols[2], doc.y, { width: 80 });
        doc.text(t('report.col_overdue'), cols[3], doc.y, { width: 80 });
        doc.moveDown(0.3);
        drawLine(doc);
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(10);
        for (const dept of deptBreakdown) {
            const y = doc.y;
            doc.text(dept.department_label || t('report.empty_dept'), cols[0], y, { width: 140 });
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
        doc.fontSize(14).font('Helvetica-Bold').text(t('report.section_users'));
        doc.moveDown(0.5);
        drawLine(doc);
        doc.moveDown(0.5);

        const cols = [50, 220, 310, 400];
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text(t('report.col_user'), cols[0], doc.y, { width: 160 });
        doc.text(t('report.col_completed'), cols[1], doc.y, { width: 80 });
        doc.text(t('report.col_overdue'), cols[2], doc.y, { width: 80 });
        doc.text(t('report.col_total_assigned'), cols[3], doc.y, { width: 100 });
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

    doc.end();
}

function drawLine(doc: PDFKit.PDFDocument) {
    doc.strokeColor('#cccccc').lineWidth(0.5)
       .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
}

async function generateExcel(res: Response, data: ReportData) {
    const { monthLabel, year, taskSummary, deptBreakdown, userBreakdown, sections, month, locale } = data;
    const t = (key: string, vars?: Record<string, string | number>) => tServer(locale, key, vars);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ETM';
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
        alignment: { horizontal: 'center' },
    };

    // Sheet 1: Summary
    if (sections.includes('tasks')) {
        const ws = workbook.addWorksheet(t('report.sheet_summary'));
        ws.columns = [{ width: 35 }, { width: 15 }];
        ws.addRow([t('report.sheet_title_monthly', { month: monthLabel, year })]).font = { bold: true, size: 14 };
        ws.addRow([]);
        const h = ws.addRow([t('report.col_indicator'), t('report.col_value')]);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        ws.addRow([t('report.stat_created'), Number(taskSummary.created)]);
        ws.addRow([t('report.stat_completed'), Number(taskSummary.completed)]);
        ws.addRow([t('report.stat_overdue'), Number(taskSummary.overdue)]);
        ws.addRow([t('report.stat_blocked'), Number(taskSummary.blocked)]);
    }

    // Sheet 2: Departments
    if (sections.includes('departments') && deptBreakdown.length > 0) {
        const ws = workbook.addWorksheet(t('report.sheet_departments'));
        ws.columns = [{ width: 25 }, { width: 12 }, { width: 14 }, { width: 12 }];
        const h = ws.addRow([
            t('report.col_department'),
            t('report.col_total'),
            t('report.col_completed'),
            t('report.col_overdue'),
        ]);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        for (const d of deptBreakdown) {
            ws.addRow([
                d.department_label || t('report.empty_dept'),
                Number(d.total),
                Number(d.completed),
                Number(d.overdue),
            ]);
        }
    }

    // Sheet 3: Users
    if (sections.includes('users') && userBreakdown.length > 0) {
        const ws = workbook.addWorksheet(t('report.sheet_users'));
        ws.columns = [{ width: 25 }, { width: 14 }, { width: 12 }, { width: 16 }];
        const h = ws.addRow([
            t('report.col_user'),
            t('report.col_completed'),
            t('report.col_overdue'),
            t('report.col_total_assigned'),
        ]);
        h.eachCell(c => { Object.assign(c.style, headerStyle); });
        for (const u of userBreakdown) {
            ws.addRow([u.display_name, Number(u.completed), Number(u.overdue), Number(u.total_assigned)]);
        }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=raport_${month}_${locale}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
}

export default router;
