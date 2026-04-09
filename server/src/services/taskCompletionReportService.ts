import pool from '../config/database';
import { escapeHtml } from './notificationEmailService';
import { DEPARTMENTS, STATUSES } from '../types/index';

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

function formatDate(d: Date | string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('ro-RO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDateOnly(d: Date | string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('ro-RO', {
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
export async function buildCompletionReportHtml(taskId: string): Promise<string> {
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
    if (!task) return '<p>Sarcina nu a fost găsită.</p>';

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

    // === BASIC INFO ===
    sections += sectionTitle('Informații generale');
    sections += infoRow('Titlu', escapeHtml(task.title));
    if (task.description) {
        sections += infoRow('Descriere', escapeHtml(task.description));
    }
    sections += infoRow('Departament', `<span style="color: ${deptInfo?.color || '#333'}; font-weight: bold;">${escapeHtml(deptLabel)}</span>`);
    sections += infoRow('Creat de', escapeHtml(task.creator_name || '—'));
    sections += infoRow('Responsabil', escapeHtml(task.assignee_name || 'Neatribuit'));
    sections += infoRow('Termen limită', formatDateOnly(task.due_date));
    sections += infoRow('Data creării', formatDate(task.created_at));
    sections += infoRow('Data finalizării', formatDate(task.updated_at));

    // === STATUS CHANGES ===
    if (statusChanges.length > 0) {
        sections += sectionTitle(`Istoricul statusurilor (${statusChanges.length})`);
        for (const sc of statusChanges) {
            const oldLabel = STATUSES[sc.old_status as keyof typeof STATUSES]?.label || sc.old_status;
            const newLabel = STATUSES[sc.new_status as keyof typeof STATUSES]?.label || sc.new_status;
            const reasonText = sc.reason ? ` — <em>Motiv: ${escapeHtml(sc.reason)}</em>` : '';
            sections += `<tr><td style="padding: 4px 0 4px 12px; font-size: 13px; color: #333; border-left: 3px solid #e5e7eb;">
                <strong>${escapeHtml(sc.changed_by_name || '—')}</strong>: ${escapeHtml(oldLabel)} → ${escapeHtml(newLabel)}${reasonText}
                <br><span style="color: #9ca3af; font-size: 11px;">${formatDate(sc.created_at)}</span>
            </td></tr>`;
        }
    }

    // === DUE DATE CHANGES ===
    if (dueDateChanges.length > 0) {
        sections += sectionTitle(`Modificări termen limită (${dueDateChanges.length})`);
        for (const dc of dueDateChanges) {
            sections += `<tr><td style="padding: 4px 0 4px 12px; font-size: 13px; color: #333; border-left: 3px solid #F59E0B;">
                <strong>${escapeHtml(dc.changed_by_name || '—')}</strong>: ${formatDateOnly(dc.old_date)} → ${formatDateOnly(dc.new_date)}
                <br><em style="color: #666;">Motiv: ${escapeHtml(dc.reason || '—')}</em>
                <br><span style="color: #9ca3af; font-size: 11px;">${formatDate(dc.created_at)}</span>
            </td></tr>`;
        }
    }

    // === SUBTASKS ===
    if (subtasks.length > 0) {
        const completedCount = subtasks.filter(s => s.is_completed).length;
        sections += sectionTitle(`Subsarcini (${completedCount}/${subtasks.length} finalizate)`);
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
        sections += sectionTitle(`Lista de verificare (${checkedCount}/${checklistItems.length})`);
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
        sections += sectionTitle(`Comentarii (${comments.length})`);
        for (const cm of comments) {
            sections += `<tr><td style="padding: 6px 0 6px 12px; font-size: 13px; color: #333; border-left: 3px solid #2563EB; margin-bottom: 4px;">
                <strong>${escapeHtml(cm.author_name || '—')}</strong>
                <span style="color: #9ca3af; font-size: 11px; margin-left: 8px;">${formatDate(cm.created_at)}</span>
                <br><span style="white-space: pre-wrap;">${escapeHtml(cm.content)}</span>
            </td></tr>`;
        }
    }

    // === ALERTS ===
    if (alerts.length > 0) {
        sections += sectionTitle(`Alerte (${alerts.length})`);
        for (const al of alerts) {
            const resolvedText = al.is_resolved
                ? `<span style="color: #10B981;">✓ Rezolvat de ${escapeHtml(al.resolver_name || '—')} (${formatDate(al.resolved_at)})</span>`
                : '<span style="color: #EF4444;">✗ Nerezolvat</span>';
            sections += `<tr><td style="padding: 4px 0 4px 12px; font-size: 13px; color: #333; border-left: 3px solid #EF4444;">
                <strong>${escapeHtml(al.creator_name || '—')}</strong>: ${escapeHtml(al.content)}
                <br>${resolvedText}
                <br><span style="color: #9ca3af; font-size: 11px;">${formatDate(al.created_at)}</span>
            </td></tr>`;
        }
    }

    // === ATTACHMENTS ===
    if (attachments.length > 0) {
        sections += sectionTitle(`Fișiere atașate (${attachments.length})`);
        for (const att of attachments) {
            const sizeKB = Math.round((att.file_size || 0) / 1024);
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; color: #333;">
                📎 <strong>${escapeHtml(att.file_name)}</strong> (${sizeKB} KB)
                — încărcat de ${escapeHtml(att.uploader_name || '—')} la ${formatDate(att.created_at)}
            </td></tr>`;
        }
    }

    // === DEPENDENCIES ===
    if (blockingDeps.length > 0 || blockedDeps.length > 0) {
        sections += sectionTitle('Dependențe');
        for (const dep of blockingDeps) {
            const statusLabel = STATUSES[dep.blocking_status as keyof typeof STATUSES]?.label || dep.blocking_status;
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; color: #333;">
                🔒 Blocată de: <strong>${escapeHtml(dep.blocking_title)}</strong> (${escapeHtml(statusLabel)})
            </td></tr>`;
        }
        for (const dep of blockedDeps) {
            const statusLabel = STATUSES[dep.blocked_status as keyof typeof STATUSES]?.label || dep.blocked_status;
            sections += `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; color: #333;">
                🔓 Blochează: <strong>${escapeHtml(dep.blocked_title)}</strong> (${escapeHtml(statusLabel)})
            </td></tr>`;
        }
    }

    // === ACTIVITY LOG ===
    if (activityLog.length > 0) {
        sections += sectionTitle(`Jurnal de activitate (${activityLog.length})`);
        const actionLabels: Record<string, string> = {
            created: 'Creat',
            status_changed: 'Status schimbat',
            due_date_changed: 'Termen modificat',
            comment_added: 'Comentariu adăugat',
            subtask_added: 'Subsarcină adăugată',
            subtask_completed: 'Subsarcină finalizată',
            subtask_assigned: 'Subsarcină atribuită',
            attachment_added: 'Fișier atașat',
            label_changed: 'Etichetă schimbată',
            recurring_created: 'Sarcină recurentă creată',
            alert_added: 'Alertă adăugată',
            alert_resolved: 'Alertă rezolvată',
            dependency_added: 'Dependență adăugată',
            dependency_removed: 'Dependență eliminată',
            dependency_resolved: 'Dependență rezolvată',
            checklist_updated: 'Lista de verificare actualizată',
            title_changed: 'Titlu schimbat',
            description_changed: 'Descriere schimbată',
            assigned_to_changed: 'Responsabil schimbat',
            department_changed: 'Departament schimbat',
            task_created: 'Sarcină creată',
            task_duplicated: 'Sarcină duplicată',
            task_deleted: 'Sarcină ștearsă',
        };
        for (const entry of activityLog) {
            const label = actionLabels[entry.action_type] || entry.action_type;
            let detailText = '';
            if (entry.details) {
                const d = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
                if (d.old_status && d.new_status) {
                    const oldL = STATUSES[d.old_status as keyof typeof STATUSES]?.label || d.old_status;
                    const newL = STATUSES[d.new_status as keyof typeof STATUSES]?.label || d.new_status;
                    detailText = `: ${oldL} → ${newL}`;
                    if (d.reason) detailText += ` (${escapeHtml(d.reason)})`;
                } else if (d.old_date && d.new_date) {
                    detailText = `: ${formatDateOnly(d.old_date)} → ${formatDateOnly(d.new_date)}`;
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
                <span style="color: #9ca3af;">${formatDate(entry.created_at)}</span>
                — <strong>${escapeHtml(entry.user_name || '—')}</strong>: ${escapeHtml(label)}${detailText}
            </td></tr>`;
        }
    }

    // ─── Assemble full email ────────────────────────────────────────────

    const safeTitle = escapeHtml(task.title);

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Visoro Task Manager</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Raport finalizare sarcină</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <div style="background: #d1fae5; border-left: 4px solid #10B981; padding: 12px 16px; margin: 0 0 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-weight: bold; color: #065f46; font-size: 16px;">✅ ${safeTitle}</p>
          <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">Sarcina a fost finalizată cu succes.</p>
        </div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          ${sections}
        </table>
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          Acest raport a fost generat automat de Visoro Task Manager la finalizarea sarcinii.
        </p>
      </div>
    </div>`;
}
