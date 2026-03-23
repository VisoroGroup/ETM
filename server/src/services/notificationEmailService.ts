import pool from '../config/database';
import { sendEmail } from './emailService';

// ─── Constants ───────────────────────────────────────────────────────────────

const APP_URL = process.env.CLIENT_URL || 'https://etm-production-62a7.up.railway.app';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if Azure Graph API credentials are configured
 */
export function hasAzureCredentials(): boolean {
    return !!(
        process.env.AZURE_CLIENT_ID &&
        process.env.AZURE_CLIENT_SECRET &&
        process.env.AZURE_TENANT_ID
    );
}

/**
 * Build a standard notification email HTML.
 * All emails share the same navy header + white card + blue CTA button design.
 */
export function buildNotificationHtml(params: {
    recipientName: string;
    subtitle: string;
    bodyLines: string[];        // HTML lines inside the card body
    taskId: string;
    taskTitle: string;
    ctaLabel?: string;          // defaults to "Deschide sarcina"
}): string {
    const { recipientName, subtitle, bodyLines, taskId, taskTitle, ctaLabel = 'Deschide sarcina' } = params;
    const firstName = recipientName.split(' ')[0];
    const taskUrl = `${APP_URL}/tasks/${taskId}`;

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Visoro Task Manager</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">${subtitle}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">Bună, <strong>${firstName}</strong>!</p>
        ${bodyLines.join('\n')}
        <div style="background: #f0f4f8; border-left: 4px solid #2563EB; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-weight: bold; color: #1E3A5F;">${taskTitle}</p>
        </div>
        <a href="${taskUrl}" style="display: inline-block; background: #2563EB; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-top: 8px;">
          ${ctaLabel}
        </a>
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          Această notificare a fost generată automat de Visoro Task Manager.
        </p>
      </div>
    </div>`;
}

/**
 * Send a notification email with fire-and-forget pattern.
 * Logs to email_logs table on success/failure.
 */
export async function sendNotificationEmail(params: {
    userId: string;
    userEmail: string;
    userName: string;
    taskId: string;
    subject: string;
    htmlBody: string;
    emailType: string;
}): Promise<void> {
    const { userId, userEmail, userName, taskId, subject, htmlBody, emailType } = params;

    if (!hasAzureCredentials()) {
        console.warn(`📧 [${emailType}] Email not sent — Azure credentials missing. To: ${userEmail}`);
        return;
    }

    try {
        await sendEmail({
            to: userEmail,
            subject,
            htmlBody,
            displayName: userName,
        });
        console.log(`📧 [${emailType}] Email sent to ${userEmail} for task ${taskId}`);

        // Log success
        await pool.query(
            `INSERT INTO email_logs (user_id, task_ids, email_type, status)
             VALUES ($1, $2, $3, 'sent')`,
            [userId, [taskId], emailType]
        ).catch(logErr => console.error(`[EMAIL_LOG] Failed to log success:`, logErr));
    } catch (err: any) {
        console.error(`📧 [${emailType}] Failed to send email to ${userEmail}:`, err?.message || err);

        // Log failure
        await pool.query(
            `INSERT INTO email_logs (user_id, task_ids, email_type, status, error_message)
             VALUES ($1, $2, $3, 'failed', $4)`,
            [userId, [taskId], emailType, (err as Error).message]
        ).catch(logErr => console.error(`[EMAIL_LOG] Failed to log failure:`, logErr));
    }
}

// ─── Stakeholder helpers ─────────────────────────────────────────────────────

interface StakeholderUser {
    id: string;
    email: string;
    display_name: string;
}

/**
 * Get all stakeholders for a task: created_by + assigned_to + subtask assignees.
 * Filters out deleted subtasks, deduplicates, and excludes the specified user.
 */
export async function getTaskStakeholders(
    taskId: string,
    excludeUserId: string
): Promise<StakeholderUser[]> {
    // Get task creator + assignee
    const { rows: taskRows } = await pool.query(
        `SELECT created_by, assigned_to FROM tasks WHERE id = $1 AND deleted_at IS NULL`,
        [taskId]
    );
    if (taskRows.length === 0) return [];

    const userIds = new Set<string>();
    if (taskRows[0].created_by) userIds.add(taskRows[0].created_by);
    if (taskRows[0].assigned_to) userIds.add(taskRows[0].assigned_to);

    // Get subtask assignees (only non-deleted subtasks)
    const { rows: subtaskRows } = await pool.query(
        `SELECT DISTINCT assigned_to FROM subtasks
         WHERE task_id = $1 AND assigned_to IS NOT NULL AND deleted_at IS NULL`,
        [taskId]
    );
    for (const row of subtaskRows) {
        userIds.add(row.assigned_to);
    }

    // Remove the actor
    userIds.delete(excludeUserId);

    if (userIds.size === 0) return [];

    // Fetch user details
    const { rows: users } = await pool.query(
        `SELECT id, email, display_name FROM users WHERE id = ANY($1) AND is_active = true`,
        [Array.from(userIds)]
    );

    return users;
}

/**
 * Get specific users by IDs (deduplicated, excluding actor).
 * Used for scoped notifications (e.g. subtask completion where we don't want ALL subtask assignees).
 */
export async function getSpecificStakeholders(
    userIds: (string | null | undefined)[],
    excludeUserId: string
): Promise<StakeholderUser[]> {
    const uniqueIds = new Set<string>();
    for (const id of userIds) {
        if (id) uniqueIds.add(id);
    }
    uniqueIds.delete(excludeUserId);

    if (uniqueIds.size === 0) return [];

    const { rows } = await pool.query(
        `SELECT id, email, display_name FROM users WHERE id = ANY($1) AND is_active = true`,
        [Array.from(uniqueIds)]
    );
    return rows;
}

/**
 * Fire-and-forget: send notification emails to multiple stakeholders.
 */
export function notifyStakeholders(params: {
    stakeholders: StakeholderUser[];
    taskId: string;
    taskTitle: string;
    subject: string;
    subtitle: string;
    bodyLines: string[];
    emailType: string;
}): void {
    const { stakeholders, taskId, taskTitle, subject, subtitle, bodyLines, emailType } = params;

    for (const user of stakeholders) {
        const htmlBody = buildNotificationHtml({
            recipientName: user.display_name,
            subtitle,
            bodyLines,
            taskId,
            taskTitle,
        });

        sendNotificationEmail({
            userId: user.id,
            userEmail: user.email,
            userName: user.display_name,
            taskId,
            subject,
            htmlBody,
            emailType,
        }).catch(err => console.error(`[${emailType}] Error:`, err));
    }
}
