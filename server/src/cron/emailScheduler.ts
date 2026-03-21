import cron from 'node-cron';
import pool from '../config/database';
import { shouldSendReminder, daysDiff, formatDateRo, isWorkingDay } from '../utils/dateUtils';
import { DEPARTMENTS } from '../types';
import { sendEmail } from '../services/emailService';

interface TaskForEmail {
    id: string;
    title: string;
    due_date: string;
    status: string;
    department_label: string;
    created_by: string;
    blocked_reason?: string;
}

interface UserEmail {
    user_id: string;
    email: string;
    display_name: string;
    overdue: TaskForEmail[];
    due_today: TaskForEmail[];
    due_soon: TaskForEmail[];
    weekly: TaskForEmail[];
    blocked: TaskForEmail[];
}

/**
 * Build the daily summary email HTML for a user
 */
function buildEmailHtml(userData: UserEmail): string {
    const firstName = userData.display_name.split(' ')[0];
    const today = formatDateRo(new Date());

    let html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Visoro Task Manager</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Sumar zilnic — ${today}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">Bună dimineața, <strong>${firstName}</strong>!</p>
        <p style="color: #666; font-size: 14px;">Iată sumarul task-urilor tale pentru astăzi:</p>
  `;

    // Overdue
    if (userData.overdue.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #EF4444; font-size: 16px; margin-bottom: 8px;">🔴 DEPĂȘITE (${userData.overdue.length})</h2>
        <div style="border-left: 3px solid #EF4444; padding-left: 12px;">
    `;
        for (const task of userData.overdue) {
            const daysOverdue = Math.abs(daysDiff(new Date(), new Date(task.due_date)));
            const dept = DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS];
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${task.title}</strong> — depășit cu ${daysOverdue} zile — <span style="color: ${dept.color};">[${dept.label}]</span></p>`;
        }
        html += `</div></div>`;
    }

    // Due today
    if (userData.due_today.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #F59E0B; font-size: 16px; margin-bottom: 8px;">🟡 SCADENTE AZI (${userData.due_today.length})</h2>
        <div style="border-left: 3px solid #F59E0B; padding-left: 12px;">
    `;
        for (const task of userData.due_today) {
            const dept = DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS];
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${task.title}</strong> — scadent azi — <span style="color: ${dept.color};">[${dept.label}]</span></p>`;
        }
        html += `</div></div>`;
    }

    // Due soon
    if (userData.due_soon.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #F97316; font-size: 16px; margin-bottom: 8px;">🟠 SCADENTE ÎN CURÂND (${userData.due_soon.length})</h2>
        <div style="border-left: 3px solid #F97316; padding-left: 12px;">
    `;
        for (const task of userData.due_soon) {
            const daysUntil = daysDiff(new Date(), new Date(task.due_date));
            const dept = DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS];
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${task.title}</strong> — scadent în ${daysUntil} zile (${formatDateRo(task.due_date)}) — <span style="color: ${dept.color};">[${dept.label}]</span></p>`;
        }
        html += `</div></div>`;
    }

    // Weekly reminders
    if (userData.weekly.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #3B82F6; font-size: 16px; margin-bottom: 8px;">📋 REMINDER SĂPTĂMÂNAL (${userData.weekly.length})</h2>
        <div style="border-left: 3px solid #3B82F6; padding-left: 12px;">
    `;
        for (const task of userData.weekly) {
            const daysUntil = daysDiff(new Date(), new Date(task.due_date));
            const dept = DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS];
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${task.title}</strong> — scadent pe ${formatDateRo(task.due_date)} (peste ${daysUntil} zile) — <span style="color: ${dept.color};">[${dept.label}]</span></p>`;
        }
        html += `</div></div>`;
    }

    // Blocked
    if (userData.blocked.length > 0) {
        html += `
      <div style="margin-top: 24px;">
        <h2 style="color: #6B7280; font-size: 16px; margin-bottom: 8px;">🚫 BLOCATE (${userData.blocked.length})</h2>
        <div style="border-left: 3px solid #6B7280; padding-left: 12px;">
    `;
        for (const task of userData.blocked) {
            const dept = DEPARTMENTS[task.department_label as keyof typeof DEPARTMENTS];
            const reason = task.blocked_reason ? ` — Motiv: ${task.blocked_reason.substring(0, 80)}${task.blocked_reason.length > 80 ? '...' : ''}` : '';
            html += `<p style="margin: 6px 0; font-size: 14px;">• <strong>${task.title}</strong>${reason} — <span style="color: ${dept.color};">[${dept.label}]</span></p>`;
        }
        html += `</div></div>`;
    }

    html += `
      <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
        Această notificare a fost generată automat de Visoro Task Manager.
      </p>
      </div>
    </div>
  `;

    return html;
}

/**
 * Run the daily email job
 */
async function runDailyEmailJob() {
    const today = new Date();

    // Only working days
    if (!isWorkingDay(today)) {
        console.log('📧 Email job skipped — not a working day');
        return;
    }

    console.log(`📧 Running daily email job for ${today.toISOString().split('T')[0]}`);

    try {
        // Get all active tasks with their blocked reasons
        const { rows: tasks } = await pool.query(`
      SELECT t.*,
        (SELECT tsc.reason FROM task_status_changes tsc
         WHERE tsc.task_id = t.id AND tsc.new_status = 'blocat'
         ORDER BY tsc.created_at DESC LIMIT 1) AS blocked_reason
      FROM tasks t
      WHERE t.status != 'terminat' AND t.deleted_at IS NULL
    `);

        // Map of user_id → UserEmail data
        const userEmails: Map<string, UserEmail> = new Map();

        // Helper to get or create user entry
        const getOrCreateUserEntry = async (userId: string): Promise<UserEmail | null> => {
            if (userEmails.has(userId)) return userEmails.get(userId)!;

            const { rows: userRows } = await pool.query(
                'SELECT id, email, display_name FROM users WHERE id = $1 AND is_active = true',
                [userId]
            );

            if (userRows.length === 0) return null;

            const entry: UserEmail = {
                user_id: userId,
                email: userRows[0].email,
                display_name: userRows[0].display_name,
                overdue: [],
                due_today: [],
                due_soon: [],
                weekly: [],
                blocked: []
            };

            userEmails.set(userId, entry);
            return entry;
        };

        for (const task of tasks) {
            const dueDate = new Date(task.due_date);
            const { send, phase } = shouldSendReminder(today, dueDate);

            if (!send && task.status !== 'blocat') continue;

            // Get all relevant users (creator + subtask assignees)
            const relevantUserIds = new Set<string>([task.created_by]);

            const { rows: subtaskAssignees } = await pool.query(
                `SELECT DISTINCT assigned_to FROM subtasks
         WHERE task_id = $1 AND assigned_to IS NOT NULL AND deleted_at IS NULL`,
                [task.id]
            );
            for (const row of subtaskAssignees) {
                relevantUserIds.add(row.assigned_to);
            }

            // Add task to each relevant user's email
            for (const userId of relevantUserIds) {
                const userEntry = await getOrCreateUserEntry(userId);
                if (!userEntry) continue;

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
                    userEntry.blocked.push(taskData);
                } else if (phase === 'overdue') {
                    userEntry.overdue.push(taskData);
                } else if (phase === 'due_today') {
                    userEntry.due_today.push(taskData);
                } else if (phase === '4_days_before' || phase === '2_days_before' || phase === '1_day_before') {
                    userEntry.due_soon.push(taskData);
                } else if (phase === 'weekly') {
                    userEntry.weekly.push(taskData);
                }
            }
        }

        // Send emails
        for (const [userId, userData] of userEmails) {
            const totalTasks = userData.overdue.length + userData.due_today.length +
                userData.due_soon.length + userData.weekly.length + userData.blocked.length;

            if (totalTasks === 0) continue;

            const taskIds = [
                ...userData.overdue,
                ...userData.due_today,
                ...userData.due_soon,
                ...userData.weekly,
                ...userData.blocked
            ].map(t => t.id);

            try {
                const emailHtml = buildEmailHtml(userData);
                const subject = `[Visoro Task Manager] Sumar zilnic — ${formatDateRo(today)}`;

                // Send via Microsoft Graph API
                if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID) {
                    await sendEmail({
                        to: userData.email,
                        subject,
                        htmlBody: emailHtml,
                        displayName: userData.display_name,
                    });
                    console.log(`📧 Email sent to ${userData.email} (${totalTasks} tasks)`);
                } else {
                    // No Graph credentials — log only
                    console.log(`📧 Email (mock — no Azure credentials) to ${userData.email}: ${subject} (${totalTasks} tasks)`);
                }

                // Log success
                await pool.query(
                    `INSERT INTO email_logs (user_id, task_ids, email_type, status)
           VALUES ($1, $2, 'daily_summary', 'sent')`,
                    [userId, taskIds]
                );
            } catch (err) {
                console.error(`Failed to send email to ${userData.email}:`, err);
                await pool.query(
                    `INSERT INTO email_logs (user_id, task_ids, email_type, status, error_message)
           VALUES ($1, $2, 'daily_summary', 'failed', $3)`,
                    [userId, taskIds, (err as Error).message]
                );
            }
        }

        console.log(`📧 Email job completed. Processed ${userEmails.size} users.`);
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
        runDailyEmailJob();
    }, {
        timezone: 'Europe/Bucharest'
    });

    console.log('📧 Email scheduler started — runs at 07:00 Europe/Bucharest, Mon-Fri');
}

// Export for manual testing
export { runDailyEmailJob };
