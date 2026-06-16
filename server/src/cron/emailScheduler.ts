import cron from 'node-cron';
import pool from '../config/database';
import { shouldSendReminder, daysDiff, isWorkingDay, todayLocal } from '../utils/dateUtils';
import { DEPARTMENTS } from '../types';
import { sendEmail } from '../services/emailService';
import { dispatchWebhook } from '../services/webhookService';
import { tServer, pickLocale, formatDateLocalized, ServerLocale } from '../i18n/serverI18n';
import { withCronLock } from './cronLock';

interface TaskForEmail {
    id: string;
    title: string;
    due_date: string;
    status: string;
    department_label: string;
    created_by: string;
    blocked_reason?: string;
}

interface UserCompanyEmail {
    user_id: string;
    company_id: number;
    email: string;
    display_name: string;
    language: ServerLocale;
    /** Only 'full'-template companies have a real department taxonomy. */
    show_department: boolean;
    overdue: TaskForEmail[];
    due_today: TaskForEmail[];
    due_soon: TaskForEmail[];
    weekly: TaskForEmail[];
    blocked: TaskForEmail[];
}

/** Escape HTML special chars to prevent stored XSS in daily summary emails. */
function escapeHtml(s: string | null | undefined): string {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build the daily summary email HTML for a user, in their company's language.
 */
function buildEmailHtml(data: UserCompanyEmail): string {
    const firstName = escapeHtml(data.display_name.split(' ')[0]);
    const today = formatDateLocalized(new Date(), data.language);
    const t = (key: string, vars?: Record<string, string | number>) =>
        tServer(data.language, `daily_email.${key}`, vars);

    const renderDept = (label: string | null | undefined): string => {
        if (!data.show_department) return '';
        const dept = DEPARTMENTS[label as keyof typeof DEPARTMENTS];
        return dept ? ` — <span style="color: ${dept.color};">[${escapeHtml(dept.label)}]</span>` : '';
    };

    let html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Sarcinator</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">${t('header_subtitle', { date: today })}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">${t('greeting', { name: firstName })}</p>
        <p style="color: #666; font-size: 14px;">${t('intro')}</p>
  `;

    // Overdue
    if (data.overdue.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #EF4444; font-size: 16px; margin-bottom: 8px;">🔴 ${t('section_overdue', { count: data.overdue.length })}</h2>
        <div style="border-left: 3px solid #EF4444; padding-left: 12px;">
    `;
        for (const task of data.overdue) {
            const daysOverdue = Math.abs(daysDiff(new Date(), new Date(task.due_date)));
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${escapeHtml(task.title)}</strong> — ${t('days_overdue', { days: daysOverdue })}${renderDept(task.department_label)}</p>`;
        }
        html += `</div></div>`;
    }

    // Due today
    if (data.due_today.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #F59E0B; font-size: 16px; margin-bottom: 8px;">🟡 ${t('section_today', { count: data.due_today.length })}</h2>
        <div style="border-left: 3px solid #F59E0B; padding-left: 12px;">
    `;
        for (const task of data.due_today) {
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${escapeHtml(task.title)}</strong> — ${t('due_today_label')}${renderDept(task.department_label)}</p>`;
        }
        html += `</div></div>`;
    }

    // Due soon
    if (data.due_soon.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #F97316; font-size: 16px; margin-bottom: 8px;">🟠 ${t('section_upcoming', { count: data.due_soon.length })}</h2>
        <div style="border-left: 3px solid #F97316; padding-left: 12px;">
    `;
        for (const task of data.due_soon) {
            const daysUntil = daysDiff(new Date(), new Date(task.due_date));
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${escapeHtml(task.title)}</strong> — ${t('due_in_days', { days: daysUntil, date: formatDateLocalized(task.due_date, data.language) })}${renderDept(task.department_label)}</p>`;
        }
        html += `</div></div>`;
    }

    // Weekly
    if (data.weekly.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #3B82F6; font-size: 16px; margin-bottom: 8px;">📋 ${t('section_weekly', { count: data.weekly.length })}</h2>
        <div style="border-left: 3px solid #3B82F6; padding-left: 12px;">
    `;
        for (const task of data.weekly) {
            const daysUntil = daysDiff(new Date(), new Date(task.due_date));
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${escapeHtml(task.title)}</strong> — ${t('weekly_due_on', { date: formatDateLocalized(task.due_date, data.language), days: daysUntil })}${renderDept(task.department_label)}</p>`;
        }
        html += `</div></div>`;
    }

    // Blocked
    if (data.blocked.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #6B7280; font-size: 16px; margin-bottom: 8px;">🚫 ${t('section_blocked', { count: data.blocked.length })}</h2>
        <div style="border-left: 3px solid #6B7280; padding-left: 12px;">
    `;
        for (const task of data.blocked) {
            const reasonRaw = task.blocked_reason
                ? task.blocked_reason.substring(0, 80) + (task.blocked_reason.length > 80 ? '...' : '')
                : '';
            const reason = reasonRaw
                ? ` — ${t('blocked_reason_prefix')}: ${escapeHtml(reasonRaw)}`
                : '';
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${escapeHtml(task.title)}</strong>${reason}${renderDept(task.department_label)}</p>`;
        }
        html += `</div></div>`;
    }

    html += `
      <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
        ${t('footer')}
      </p>
      </div>
    </div>
  `;

    return html;
}

/**
 * Run the daily email job.
 *
 * Per-tenant behaviour: every email represents ONE (user, company) pair.
 * If a user belongs to 3 companies and has tasks in each, they get 3 emails
 * — each in that company's configured language.
 */
async function runDailyEmailJob() {
    const today = new Date();

    // Only working days
    if (!isWorkingDay(today)) {
        console.log('📧 Email job skipped — not a working day');
        return;
    }

    console.log(`📧 Running daily email job for ${todayLocal()}`);

    try {
        // Load all active tasks (with company_id) + most recent blocked reason
        const { rows: tasks } = await pool.query(`
      SELECT t.*,
        (SELECT tsc.reason FROM task_status_changes tsc
         WHERE tsc.task_id = t.id AND tsc.new_status = 'blocat'
         ORDER BY tsc.created_at DESC, tsc.id DESC LIMIT 1) AS blocked_reason
      FROM tasks t
      WHERE t.status != 'terminat' AND t.deleted_at IS NULL
    `);

        // All active users
        const { rows: allUsers } = await pool.query(
            `SELECT id, email, display_name FROM users WHERE is_active = true`
        );
        const usersMap = new Map<string, { id: string; email: string; display_name: string }>(
            allUsers.map(u => [u.id, u])
        );

        // All companies (id → language + template_type)
        const { rows: allCompanies } = await pool.query(
            `SELECT id, language, template_type FROM companies WHERE is_archived = false`
        );
        const companyLangMap = new Map<number, ServerLocale>(
            allCompanies.map((c: { id: number; language: string }) => [c.id, pickLocale(c.language)])
        );
        const companyTemplateMap = new Map<number, string>(
            allCompanies.map((c: { id: number; template_type: string }) => [c.id, c.template_type])
        );

        // Membership: user_id → Set<company_id>
        const { rows: memberships } = await pool.query(
            `SELECT user_id, company_id FROM user_companies`
        );
        const userCompanies = new Map<string, Set<number>>();
        for (const row of memberships) {
            if (!userCompanies.has(row.user_id)) userCompanies.set(row.user_id, new Set());
            userCompanies.get(row.user_id)!.add(row.company_id);
        }

        // Subtask assignees grouped by task_id
        const taskIds = tasks.map(t => t.id);
        const subtaskAssigneesMap = new Map<string, string[]>();
        if (taskIds.length > 0) {
            const { rows: allAssignees } = await pool.query(
                `SELECT task_id, assigned_to FROM subtasks
                 WHERE task_id = ANY($1::uuid[]) AND assigned_to IS NOT NULL AND deleted_at IS NULL`,
                [taskIds]
            );
            for (const row of allAssignees) {
                if (!subtaskAssigneesMap.has(row.task_id)) subtaskAssigneesMap.set(row.task_id, []);
                const arr = subtaskAssigneesMap.get(row.task_id)!;
                if (!arr.includes(row.assigned_to)) arr.push(row.assigned_to);
            }
        }

        // Bucket key: `${user_id}::${company_id}`
        const bucketKey = (userId: string, companyId: number) => `${userId}::${companyId}`;
        const buckets: Map<string, UserCompanyEmail> = new Map();

        const getOrCreateBucket = (userId: string, companyId: number): UserCompanyEmail | null => {
            const key = bucketKey(userId, companyId);
            if (buckets.has(key)) return buckets.get(key)!;

            const user = usersMap.get(userId);
            if (!user) return null;

            // The user must actually be a member of this company. Otherwise we
            // would email them about a tenant they no longer belong to.
            const memberOf = userCompanies.get(userId);
            if (!memberOf || !memberOf.has(companyId)) return null;

            const language = companyLangMap.get(companyId) || 'ro';
            const showDepartment = (companyTemplateMap.get(companyId) || 'simple') === 'full';

            const entry: UserCompanyEmail = {
                user_id: userId,
                company_id: companyId,
                email: user.email,
                display_name: user.display_name,
                language,
                show_department: showDepartment,
                overdue: [],
                due_today: [],
                due_soon: [],
                weekly: [],
                blocked: []
            };
            buckets.set(key, entry);
            return entry;
        };

        for (const task of tasks) {
            const companyId: number | null = task.company_id ?? null;
            if (companyId == null) continue; // safety: skip tasks with no tenant

            const dueDate = new Date(task.due_date);
            const { send, phase } = shouldSendReminder(today, dueDate);
            if (!send && task.status !== 'blocat') continue;

            // Stakeholders for this task: creator + subtask assignees
            const relevantUserIds = new Set<string>([task.created_by]);
            const assignees = subtaskAssigneesMap.get(task.id) || [];
            for (const uid of assignees) relevantUserIds.add(uid);

            for (const userId of relevantUserIds) {
                const bucket = getOrCreateBucket(userId, companyId);
                if (!bucket) continue;

                const taskData: TaskForEmail = {
                    id: task.id,
                    title: task.title,
                    due_date: task.due_date,
                    status: task.status,
                    department_label: task.department_label,
                    created_by: task.created_by,
                    blocked_reason: task.blocked_reason
                };

                if (task.status === 'blocat') {
                    bucket.blocked.push(taskData);
                } else if (phase === 'overdue') {
                    bucket.overdue.push(taskData);
                    const daysOver = Math.abs(daysDiff(today, dueDate));
                    dispatchWebhook('task.overdue', {
                        task: { id: task.id, title: task.title, due_date: task.due_date, status: task.status, department_label: task.department_label, company_id: task.company_id },
                        company_id: task.company_id,
                        days_overdue: daysOver
                    }).catch(err => console.error('[WEBHOOK] task.overdue dispatch error:', err.message));
                } else if (phase === 'due_today') {
                    bucket.due_today.push(taskData);
                } else if (phase === '4_days_before' || phase === '2_days_before' || phase === '1_day_before') {
                    bucket.due_soon.push(taskData);
                } else if (phase === 'weekly') {
                    bucket.weekly.push(taskData);
                }
            }
        }

        // Send one email per (user, company) bucket that actually has tasks.
        for (const [, data] of buckets) {
            const totalTasks = data.overdue.length + data.due_today.length +
                data.due_soon.length + data.weekly.length + data.blocked.length;
            if (totalTasks === 0) continue;

            const taskIdsForLog = [
                ...data.overdue, ...data.due_today, ...data.due_soon,
                ...data.weekly, ...data.blocked
            ].map(t => t.id);

            try {
                const emailHtml = buildEmailHtml(data);
                const subject = tServer(data.language, 'daily_email.subject', {
                    date: formatDateLocalized(today, data.language),
                });

                if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID) {
                    await sendEmail({
                        to: data.email,
                        subject,
                        htmlBody: emailHtml,
                        displayName: data.display_name,
                    });
                    console.log(`📧 Email sent to ${data.email} [company ${data.company_id}, lang ${data.language}] (${totalTasks} tasks)`);
                } else {
                    console.log(`📧 Email (mock — no Azure credentials) to ${data.email} [company ${data.company_id}]: ${subject} (${totalTasks} tasks)`);
                }

                await pool.query(
                    `INSERT INTO email_logs (user_id, task_ids, email_type, status, company_id)
                     VALUES ($1, $2, 'daily_summary', 'sent', $3)`,
                    [data.user_id, taskIdsForLog, data.company_id]
                );
            } catch (err) {
                console.error(`Failed to send email to ${data.email} [company ${data.company_id}]:`, err);
                await pool.query(
                    `INSERT INTO email_logs (user_id, task_ids, email_type, status, error_message, company_id)
                     VALUES ($1, $2, 'daily_summary', 'failed', $3, $4)`,
                    [data.user_id, taskIdsForLog, (err as Error).message, data.company_id]
                );
            }
        }

        console.log(`📧 Email job completed. Processed ${buckets.size} (user, company) buckets.`);
    } catch (err) {
        console.error('Email job failed:', err);
    }
}

/**
 * Start the email scheduler cron job
 * Runs at 07:00 Europe/Bucharest, Monday-Friday
 */
export function startEmailScheduler() {
    // "0 7 * * 1-5" = at 07:00 on Mon-Fri
    cron.schedule('0 7 * * 1-5', () => {
        // Wrap in advisory lock so multi-replica deploys don't double-fire.
        withCronLock(91001, 'daily_email_job', runDailyEmailJob)
            .catch((err) => console.error('[daily_email_job] lock/run error:', err));
    }, {
        timezone: 'Europe/Bucharest'
    });

    console.log('📧 Email scheduler started — runs at 07:00 Europe/Bucharest, Mon-Fri');
}

// Export for manual testing
export { runDailyEmailJob };
