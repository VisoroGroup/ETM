import pool from '../config/database';
import { escapeHtml } from './notificationEmailService';
import { DEPARTMENTS, STATUSES } from '../types/index';
import { ServerLocale } from '../i18n/serverI18n';

// ─── Localized labels ───────────────────────────────────────────────────────
// Kept inline (not in serverI18n.ts) because this file owns ~40 single-use
// strings — externalising them would dwarf the rest of i18n.
const REPORT_LABELS: Record<ServerLocale, Record<string, string>> = {
    ro: {
        title: 'Sarcinator Visoro',
        subtitle: 'Raport finalizare sarcină',
        success: 'Sarcina a fost finalizată cu succes.',
        footer: 'Acest raport a fost generat automat de Sarcinator Visoro la finalizarea sarcinii.',
        general: 'Informații generale',
        title_field: 'Titlu',
        description: 'Descriere',
        department: 'Departament',
        creator: 'Creat de',
        assignee: 'Responsabil',
        unassigned: 'Neatribuit',
        due_date: 'Termen limită',
        created_at: 'Data creării',
        completed_at: 'Data finalizării',
        completed_by: 'Finalizat de {name}',
        status_history: 'Istoricul statusurilor',
        due_date_changes: 'Modificări termen limită',
        reason_label: 'Motiv',
        subtasks: 'Subsarcini',
        subtasks_progress: '{count}/{total} finalizate',
        checklist: 'Lista de verificare',
        comments: 'Comentarii',
        alerts: 'Alerte',
        alert_resolved: 'Rezolvat de {name} ({date})',
        alert_unresolved: 'Nerezolvat',
        attachments: 'Fișiere atașate',
        uploaded_by: 'încărcat de {name} la {date}',
        dependencies: 'Dependențe',
        blocked_by: 'Blocată de',
        blocks: 'Blochează',
        activity: 'Jurnal de activitate',
        not_found: 'Sarcina nu a fost găsită.',
        dash: '—',
        // Status labels (mirror types/index.ts STATUSES)
        status_de_rezolvat: 'De rezolvat',
        status_in_realizare: 'În realizare',
        status_terminat: 'Terminat',
        status_blocat: 'Blocat',
        // Activity log action labels
        action_created: 'Creat',
        action_status_changed: 'Status schimbat',
        action_due_date_changed: 'Termen modificat',
        action_comment_added: 'Comentariu adăugat',
        action_subtask_added: 'Subsarcină adăugată',
        action_subtask_completed: 'Subsarcină finalizată',
        action_subtask_assigned: 'Subsarcină atribuită',
        action_attachment_added: 'Fișier atașat',
        action_label_changed: 'Etichetă schimbată',
        action_recurring_created: 'Sarcină recurentă creată',
        action_alert_added: 'Alertă adăugată',
        action_alert_resolved: 'Alertă rezolvată',
        action_dependency_added: 'Dependență adăugată',
        action_dependency_removed: 'Dependență eliminată',
        action_dependency_resolved: 'Dependență rezolvată',
        action_checklist_updated: 'Lista de verificare actualizată',
        action_title_changed: 'Titlu schimbat',
        action_description_changed: 'Descriere schimbată',
        action_assigned_to_changed: 'Responsabil schimbat',
        action_department_changed: 'Departament schimbat',
        action_task_created: 'Sarcină creată',
        action_task_duplicated: 'Sarcină duplicată',
        action_task_deleted: 'Sarcină ștearsă',
    },
    hu: {
        title: 'Sarcinator Visoro',
        subtitle: 'Feladat befejezési jelentés',
        success: 'A feladat sikeresen befejeződött.',
        footer: 'Ezt a jelentést automatikusan generálta a Sarcinator Visoro a feladat lezárásakor.',
        general: 'Általános információk',
        title_field: 'Cím',
        description: 'Leírás',
        department: 'Részleg',
        creator: 'Létrehozta',
        assignee: 'Felelős',
        unassigned: 'Nincs hozzárendelve',
        due_date: 'Határidő',
        created_at: 'Létrehozás dátuma',
        completed_at: 'Befejezés dátuma',
        completed_by: 'Lezárta: {name}',
        status_history: 'Státuszelőzmények',
        due_date_changes: 'Határidő-módosítások',
        reason_label: 'Indok',
        subtasks: 'Részfeladatok',
        subtasks_progress: '{count}/{total} kész',
        checklist: 'Ellenőrzőlista',
        comments: 'Hozzászólások',
        alerts: 'Riasztások',
        alert_resolved: 'Megoldotta {name} ({date})',
        alert_unresolved: 'Megoldatlan',
        attachments: 'Csatolmányok',
        uploaded_by: 'feltöltötte: {name} ({date})',
        dependencies: 'Függőségek',
        blocked_by: 'Blokkolja',
        blocks: 'Blokkolja',
        activity: 'Tevékenységnapló',
        not_found: 'A feladat nem található.',
        dash: '—',
        // Státusz feliratok
        status_de_rezolvat: 'Megoldandó',
        status_in_realizare: 'Folyamatban',
        status_terminat: 'Befejezve',
        status_blocat: 'Blokkolva',
        // Tevékenységnapló feliratok
        action_created: 'Létrehozva',
        action_status_changed: 'Státusz módosítva',
        action_due_date_changed: 'Határidő módosítva',
        action_comment_added: 'Hozzászólás hozzáadva',
        action_subtask_added: 'Részfeladat hozzáadva',
        action_subtask_completed: 'Részfeladat befejezve',
        action_subtask_assigned: 'Részfeladat hozzárendelve',
        action_attachment_added: 'Csatolmány hozzáadva',
        action_label_changed: 'Címke módosítva',
        action_recurring_created: 'Ismétlődő feladat létrehozva',
        action_alert_added: 'Riasztás hozzáadva',
        action_alert_resolved: 'Riasztás megoldva',
        action_dependency_added: 'Függőség hozzáadva',
        action_dependency_removed: 'Függőség eltávolítva',
        action_dependency_resolved: 'Függőség megoldva',
        action_checklist_updated: 'Ellenőrzőlista frissítve',
        action_title_changed: 'Cím módosítva',
        action_description_changed: 'Leírás módosítva',
        action_assigned_to_changed: 'Felelős módosítva',
        action_department_changed: 'Részleg módosítva',
        action_task_created: 'Feladat létrehozva',
        action_task_duplicated: 'Feladat duplikálva',
        action_task_deleted: 'Feladat törölve',
    },
    en: {
        title: 'Sarcinator Visoro',
        subtitle: 'Task completion report',
        success: 'The task was completed successfully.',
        footer: 'This report was generated automatically by Sarcinator Visoro on task completion.',
        general: 'General information',
        title_field: 'Title',
        description: 'Description',
        department: 'Department',
        creator: 'Created by',
        assignee: 'Assignee',
        unassigned: 'Unassigned',
        due_date: 'Due date',
        created_at: 'Created at',
        completed_at: 'Completed at',
        completed_by: 'Completed by {name}',
        status_history: 'Status history',
        due_date_changes: 'Due date changes',
        reason_label: 'Reason',
        subtasks: 'Subtasks',
        subtasks_progress: '{count}/{total} done',
        checklist: 'Checklist',
        comments: 'Comments',
        alerts: 'Alerts',
        alert_resolved: 'Resolved by {name} ({date})',
        alert_unresolved: 'Unresolved',
        attachments: 'Attachments',
        uploaded_by: 'uploaded by {name} on {date}',
        dependencies: 'Dependencies',
        blocked_by: 'Blocked by',
        blocks: 'Blocks',
        activity: 'Activity log',
        not_found: 'Task not found.',
        dash: '—',
        // Status labels
        status_de_rezolvat: 'To do',
        status_in_realizare: 'In progress',
        status_terminat: 'Completed',
        status_blocat: 'Blocked',
        // Activity log action labels
        action_created: 'Created',
        action_status_changed: 'Status changed',
        action_due_date_changed: 'Due date changed',
        action_comment_added: 'Comment added',
        action_subtask_added: 'Subtask added',
        action_subtask_completed: 'Subtask completed',
        action_subtask_assigned: 'Subtask assigned',
        action_attachment_added: 'Attachment added',
        action_label_changed: 'Label changed',
        action_recurring_created: 'Recurring task created',
        action_alert_added: 'Alert added',
        action_alert_resolved: 'Alert resolved',
        action_dependency_added: 'Dependency added',
        action_dependency_removed: 'Dependency removed',
        action_dependency_resolved: 'Dependency resolved',
        action_checklist_updated: 'Checklist updated',
        action_title_changed: 'Title changed',
        action_description_changed: 'Description changed',
        action_assigned_to_changed: 'Assignee changed',
        action_department_changed: 'Department changed',
        action_task_created: 'Task created',
        action_task_duplicated: 'Task duplicated',
        action_task_deleted: 'Task deleted',
    },
};

function L(lang: ServerLocale, key: string, vars?: Record<string, string | number>): string {
    const dict = REPORT_LABELS[lang] ?? REPORT_LABELS.ro;
    let s = dict[key] ?? REPORT_LABELS.ro[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
    }
    return s;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportRecipient {
    id: string;
    email: string;
    display_name: string;
}

// ─── Always-receive emails (Robert & Maria get ALL completion reports) ───────

const ALWAYS_RECEIVE_EMAILS = [
    'robert.ledenyi@visoro-global.ro',
    'maria.vaszi@visoro-global.ro',
];

// ─── Recipient logic ────────────────────────────────────────────────────────

/**
 * Determine who should receive the completion report email.
 *
 * Rules:
 * 1. If creator ≠ assignee → creator receives
 * 2. If creator = assignee → the assignee's supervisors (reports_to) receive
 * 3. If no supervisor → the completer receives
 * 4. Robert & Maria ALWAYS receive every completion report
 * 5. Deduplicate
 */
export async function getCompletionReportRecipients(
    taskId: string,
    completedByUserId: string
): Promise<ReportRecipient[]> {
    // Get task creator and assignee
    const { rows: taskRows } = await pool.query(
        `SELECT created_by, assigned_to FROM tasks WHERE id = $1`,
        [taskId]
    );
    if (taskRows.length === 0) return [];

    const { created_by, assigned_to } = taskRows[0];
    const recipientIds = new Set<string>();

    if (created_by !== assigned_to && assigned_to) {
        // Creator ≠ assignee → creator gets the report
        recipientIds.add(created_by);
    } else {
        // Creator = assignee (or no assignee) → supervisors get it
        const { rows: supervisorRows } = await pool.query(
            `SELECT reports_to FROM users WHERE id = $1`,
            [completedByUserId]
        );
        const reportsTo: string[] = supervisorRows[0]?.reports_to || [];
        if (reportsTo.length > 0) {
            for (const supId of reportsTo) {
                recipientIds.add(supId);
            }
        } else {
            // No supervisor → completer gets it (Robert's case)
            recipientIds.add(completedByUserId);
        }
    }

    // Robert & Maria ALWAYS receive
    const { rows: alwaysRows } = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = ANY($1) AND is_active = true`,
        [ALWAYS_RECEIVE_EMAILS.map(e => e.toLowerCase())]
    );
    for (const row of alwaysRows) {
        recipientIds.add(row.id);
    }

    // Fetch full user details for all recipients
    const { rows: recipients } = await pool.query(
        `SELECT id, email, display_name FROM users WHERE id = ANY($1) AND is_active = true`,
        [Array.from(recipientIds)]
    );
    return recipients;
}

// ─── HTML Report Builder ────────────────────────────────────────────────────

const LOCALE_BCP47: Record<ServerLocale, string> = {
    ro: 'ro-RO',
    hu: 'hu-HU',
    en: 'en-GB',
};

function formatDate(d: Date | string | null, lang: ServerLocale = 'ro'): string {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString(LOCALE_BCP47[lang], {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDateOnly(d: Date | string | null, lang: ServerLocale = 'ro'): string {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString(LOCALE_BCP47[lang], {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

const sectionTitle = (title: string) => `
    <tr><td style="padding: 16px 0 8px 0;">
        <h3 style="margin: 0; color: #1E3A5F; font-size: 15px; border-bottom: 2px solid #2563EB; padding-bottom: 6px;">${title}</h3>
    </td></tr>`;

const infoRow = (label: string, value: string) => `
    <tr><td style="padding: 4px 0; font-size: 13px; color: #333;">
        <strong style="color: #555;">${label}:</strong> ${value}
    </td></tr>`;

/**
 * Build a comprehensive HTML completion report for a task.
 * Gathers ALL data: basic info, status changes, due date changes,
 * comments, subtasks, checklist items, alerts, attachments, dependencies, activity log.
 */
export async function buildCompletionReportHtml(
    taskId: string,
    language: ServerLocale = 'ro',
    statusChange?: { oldStatus: string; newStatus: string; actorName: string; reason?: string | null },
): Promise<string> {
    const t = (k: string, vars?: Record<string, string | number>) => L(language, k, vars);
    // 1. Task basic info
    const { rows: [task] } = await pool.query(
        `SELECT t.*,
                c.display_name AS creator_name, c.email AS creator_email,
                a.display_name AS assignee_name, a.email AS assignee_email
         FROM tasks t
         LEFT JOIN users c ON t.created_by = c.id
         LEFT JOIN users a ON t.assigned_to = a.id
         WHERE t.id = $1`,
        [taskId]
    );
    if (!task) return `<p>${t('not_found')}</p>`;

    const deptInfo = DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS];
    const deptLabel = deptInfo?.label || task.department_label;

    // 2. Status changes
    const { rows: statusChanges } = await pool.query(
        `SELECT sc.*, u.display_name AS changed_by_name
         FROM task_status_changes sc
         LEFT JOIN users u ON sc.changed_by = u.id
         WHERE sc.task_id = $1
         ORDER BY sc.created_at ASC`,
        [taskId]
    );

    // 3. Due date changes
    const { rows: dueDateChanges } = await pool.query(
        `SELECT dc.*, u.display_name AS changed_by_name
         FROM task_due_date_changes dc
         LEFT JOIN users u ON dc.changed_by = u.id
         WHERE dc.task_id = $1
         ORDER BY dc.created_at ASC`,
        [taskId]
    );

    // 4. Comments
    const { rows: comments } = await pool.query(
        `SELECT c.*, u.display_name AS author_name
         FROM task_comments c
         LEFT JOIN users u ON c.author_id = u.id
         WHERE c.task_id = $1
         ORDER BY c.created_at ASC`,
        [taskId]
    );

    // 5. Subtasks
    const { rows: subtasks } = await pool.query(
        `SELECT s.*, u.display_name AS assignee_name
         FROM subtasks s
         LEFT JOIN users u ON s.assigned_to = u.id
         WHERE s.task_id = $1 AND s.deleted_at IS NULL
         ORDER BY s.order_index ASC`,
        [taskId]
    );

    // 6. Checklist items
    const { rows: checklistItems } = await pool.query(
        `SELECT * FROM task_checklist_items
         WHERE task_id = $1
         ORDER BY order_index ASC`,
        [taskId]
    );

    // 7. Alerts
    const { rows: alerts } = await pool.query(
        `SELECT al.*,
                c.display_name AS creator_name,
                r.display_name AS resolver_name
         FROM task_alerts al
         LEFT JOIN users c ON al.created_by = c.id
         LEFT JOIN users r ON al.resolved_by = r.id
         WHERE al.task_id = $1
         ORDER BY al.created_at ASC`,
        [taskId]
    );

    // 8. Attachments
    const { rows: attachments } = await pool.query(
        `SELECT att.*, u.display_name AS uploader_name
         FROM task_attachments att
         LEFT JOIN users u ON att.uploaded_by = u.id
         WHERE att.task_id = $1
         ORDER BY att.created_at ASC`,
        [taskId]
    );

    // 9. Dependencies
    const { rows: blockingDeps } = await pool.query(
        `SELECT td.*, t.title AS blocking_title, t.status AS blocking_status
         FROM task_dependencies td
         JOIN tasks t ON td.blocking_task_id = t.id
         WHERE td.blocked_task_id = $1`,
        [taskId]
    );
    const { rows: blockedDeps } = await pool.query(
        `SELECT td.*, t.title AS blocked_title, t.status AS blocked_status
         FROM task_dependencies td
         JOIN tasks t ON td.blocked_task_id = t.id
         WHERE td.blocking_task_id = $1`,
        [taskId]
    );

    // 10. Activity log
    const { rows: activityLog } = await pool.query(
        `SELECT al.*, u.display_name AS user_name
         FROM activity_log al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.task_id = $1
         ORDER BY al.created_at ASC`,
        [taskId]
    );

    // ─── Build HTML sections ────────────────────────────────────────────

    let sections = '';

    const dash = t('dash');

    // === BASIC INFO ===
    sections += sectionTitle(t('general'));
    sections += infoRow(t('title_field'), escapeHtml(task.title));
    if (task.description) {
        sections += infoRow(t('description'), escapeHtml(task.description));
    }
    sections += infoRow(t('department'), `<span style="color: ${deptInfo?.color || '#333'}; font-weight: bold;">${escapeHtml(deptLabel)}</span>`);
    sections += infoRow(t('creator'), escapeHtml(task.creator_name || dash));
    sections += infoRow(t('assignee'), escapeHtml(task.assignee_name || t('unassigned')));
    sections += infoRow(t('due_date'), formatDateOnly(task.due_date, language));
    sections += infoRow(t('created_at'), formatDate(task.created_at, language));
    sections += infoRow(t('completed_at'), formatDate(task.updated_at, language));

    // === STATUS CHANGES ===
    if (statusChanges.length > 0) {
        sections += sectionTitle(`${t('status_history')} (${statusChanges.length})`);
        for (const sc of statusChanges) {
            const oldLabel = t(`status_${sc.old_status}`) || STATUSES[sc.old_status as keyof typeof STATUSES]?.label || sc.old_status;
            const newLabel = t(`status_${sc.new_status}`) || STATUSES[sc.new_status as keyof typeof STATUSES]?.label || sc.new_status;
            const reasonText = sc.reason ? ` — <em>${t('reason_label')}: ${escapeHtml(sc.reason)}</em>` : '';
            sections += `<tr><td style="padding: 4px 0 4px 12px; font-size: 13px; color: #333; border-left: 3px solid #e5e7eb;">
                <strong>${escapeHtml(sc.changed_by_name || dash)}</strong>: ${escapeHtml(oldLabel)} → ${escapeHtml(newLabel)}${reasonText}
                <br><span style="color: #9ca3af; font-size: 11px;">${formatDate(sc.created_at, language)}</span>
            </td></tr>`;
        }
    }

    // === DUE DATE CHANGES ===
    if (dueDateChanges.length > 0) {
        sections += sectionTitle(`${t('due_date_changes')} (${dueDateChanges.length})`);
        for (const dc of dueDateChanges) {
            sections += `<tr><td style="padding: 4px 0 4px 12px; font-size: 13px; color: #333; border-left: 3px solid #F59E0B;">
                <strong>${escapeHtml(dc.changed_by_name || dash)}</strong>: ${formatDateOnly(dc.old_date, language)} → ${formatDateOnly(dc.new_date, language)}
                <br><em style="color: #666;">${t('reason_label')}: ${escapeHtml(dc.reason || dash)}</em>
                <br><span style="color: #9ca3af; font-size: 11px;">${formatDate(dc.created_at, language)}</span>
            </td></tr>`;
        }
    }

    // === SUBTASKS ===
    if (subtasks.length > 0) {
        const completedCount = subtasks.filter(s => s.is_completed).length;
        sections += sectionTitle(`${t('subtasks')} (${t('subtasks_progress', { count: completedCount, total: subtasks.length })})`);
        for (const st of subtasks) {
            const icon = st.is_completed ? '✅' : '⬜';
            const assignee = st.assignee_name ? ` — <em>${escapeHtml(st.assignee_name)}</em>` : '';
            const style = st.is_completed ? 'text-decoration: line-through; color: #9ca3af;' : '';
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; ${style}">
                ${icon} ${escapeHtml(st.title)}${assignee}
            </td></tr>`;
        }
    }

    // === CHECKLIST ===
    if (checklistItems.length > 0) {
        const checkedCount = checklistItems.filter(c => c.is_checked).length;
        sections += sectionTitle(`${t('checklist')} (${checkedCount}/${checklistItems.length})`);
        for (const ci of checklistItems) {
            const icon = ci.is_checked ? '☑' : '☐';
            const style = ci.is_checked ? 'text-decoration: line-through; color: #9ca3af;' : '';
            sections += `<tr><td style="padding: 2px 0 2px 12px; font-size: 13px; ${style}">
                ${icon} ${escapeHtml(ci.title)}
            </td></tr>`;
        }
    }

    // === COMMENTS ===
    if (comments.length > 0) {
        sections += sectionTitle(`${t('comments')} (${comments.length})`);
        for (const cm of comments) {
            sections += `<tr><td style="padding: 6px 0 6px 12px; font-size: 13px; color: #333; border-left: 3px solid #2563EB; margin-bottom: 4px;">
                <strong>${escapeHtml(cm.author_name || dash)}</strong>
                <span style="color: #9ca3af; font-size: 11px; margin-left: 8px;">${formatDate(cm.created_at, language)}</span>
                <br><span style="white-space: pre-wrap;">${escapeHtml(cm.content)}</span>
            </td></tr>`;
        }
    }

    // === ALERTS ===
    if (alerts.length > 0) {
        sections += sectionTitle(`${t('alerts')} (${alerts.length})`);
        for (const al of alerts) {
            const resolvedText = al.is_resolved
                ? `<span style="color: #10B981;">✓ ${t('alert_resolved', { name: escapeHtml(al.resolver_name || dash), date: formatDate(al.resolved_at, language) })}</span>`
                : `<span style="color: #EF4444;">✗ ${t('alert_unresolved')}</span>`;
            sections += `<tr><td style="padding: 4px 0 4px 12px; font-size: 13px; color: #333; border-left: 3px solid #EF4444;">
                <strong>${escapeHtml(al.creator_name || dash)}</strong>: ${escapeHtml(al.content)}
                <br>${resolvedText}
                <br><span style="color: #9ca3af; font-size: 11px;">${formatDate(al.created_at, language)}</span>
            </td></tr>`;
        }
    }

    // === ATTACHMENTS ===
    if (attachments.length > 0) {
        sections += sectionTitle(`${t('attachments')} (${attachments.length})`);
        for (const att of attachments) {
            const sizeKB = Math.round((att.file_size || 0) / 1024);
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; color: #333;">
                📎 <strong>${escapeHtml(att.file_name)}</strong> (${sizeKB} KB)
                — ${t('uploaded_by', { name: escapeHtml(att.uploader_name || dash), date: formatDate(att.created_at, language) })}
            </td></tr>`;
        }
    }

    // === DEPENDENCIES ===
    if (blockingDeps.length > 0 || blockedDeps.length > 0) {
        sections += sectionTitle(t('dependencies'));
        for (const dep of blockingDeps) {
            const statusLabel = t(`status_${dep.blocking_status}`) || STATUSES[dep.blocking_status as keyof typeof STATUSES]?.label || dep.blocking_status;
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; color: #333;">
                🔒 ${t('blocked_by')}: <strong>${escapeHtml(dep.blocking_title)}</strong> (${escapeHtml(statusLabel)})
            </td></tr>`;
        }
        for (const dep of blockedDeps) {
            const statusLabel = t(`status_${dep.blocked_status}`) || STATUSES[dep.blocked_status as keyof typeof STATUSES]?.label || dep.blocked_status;
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; color: #333;">
                🔓 ${t('blocks')}: <strong>${escapeHtml(dep.blocked_title)}</strong> (${escapeHtml(statusLabel)})
            </td></tr>`;
        }
    }

    // === ACTIVITY LOG ===
    if (activityLog.length > 0) {
        sections += sectionTitle(`${t('activity')} (${activityLog.length})`);
        for (const entry of activityLog) {
            // Look up the localized action label; fall back to the raw action_type
            // if no translation exists (covers new actions added after this list).
            const localized = t(`action_${entry.action_type}`);
            const label = (localized && localized !== `action_${entry.action_type}`)
                ? localized
                : entry.action_type;
            let detailText = '';
            if (entry.details) {
                const d = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
                if (d.old_status && d.new_status) {
                    const oldL = t(`status_${d.old_status}`) || STATUSES[d.old_status as keyof typeof STATUSES]?.label || d.old_status;
                    const newL = t(`status_${d.new_status}`) || STATUSES[d.new_status as keyof typeof STATUSES]?.label || d.new_status;
                    detailText = `: ${oldL} → ${newL}`;
                    if (d.reason) detailText += ` (${escapeHtml(d.reason)})`;
                } else if (d.old_date && d.new_date) {
                    detailText = `: ${formatDateOnly(d.old_date, language)} → ${formatDateOnly(d.new_date, language)}`;
                    if (d.reason) detailText += ` (${escapeHtml(d.reason)})`;
                } else if (d.subtask_title) {
                    detailText = `: ${escapeHtml(d.subtask_title)}`;
                } else if (d.file_name) {
                    detailText = `: ${escapeHtml(d.file_name)}`;
                } else if (d.content) {
                    detailText = `: ${escapeHtml(String(d.content).substring(0, 80))}`;
                }
            }
            sections += `<tr><td style="padding: 2px 0 2px 12px; font-size: 12px; color: #666;">
                <span style="color: #9ca3af;">${formatDate(entry.created_at, language)}</span>
                — <strong>${escapeHtml(entry.user_name || dash)}</strong>: ${escapeHtml(label)}${detailText}
            </td></tr>`;
        }
    }

    // ─── Assemble full email ────────────────────────────────────────────

    const safeTitle = escapeHtml(task.title);

    // When this report doubles as the completion email (on `terminat` the separate
    // status-change email is suppressed), render the status transition and who
    // completed the task at the very top, inside the success banner.
    let statusChangeHtml = '';
    if (statusChange) {
        const oldLabel = escapeHtml(t(`status_${statusChange.oldStatus}`));
        const newLabel = escapeHtml(t(`status_${statusChange.newStatus}`));
        const reasonLine = statusChange.reason
            ? `<p style="margin: 6px 0 0; color: #b45309; font-size: 12px;">${t('reason_label')}: ${escapeHtml(statusChange.reason)}</p>`
            : '';
        statusChangeHtml = `
          <p style="margin: 10px 0 0; font-size: 13px;">
            <span style="background: #e5e7eb; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${oldLabel}</span>
            → <span style="background: #10B981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${newLabel}</span>
          </p>
          <p style="margin: 6px 0 0; color: #047857; font-size: 12px;">${t('completed_by', { name: escapeHtml(statusChange.actorName) })}</p>
          ${reasonLine}`;
    }

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">${t('title')}</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">${t('subtitle')}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <div style="background: #d1fae5; border-left: 4px solid #10B981; padding: 12px 16px; margin: 0 0 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-weight: bold; color: #065f46; font-size: 16px;">✅ ${safeTitle}</p>
          <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">${t('success')}</p>${statusChangeHtml}
        </div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          ${sections}
        </table>
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          ${t('footer')}
        </p>
      </div>
    </div>`;
}
