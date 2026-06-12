import pool from '../config/database';
import { sendEmail } from './emailService';
import { tServer, pickLocale, ServerLocale } from '../i18n/serverI18n';

// ─── Constants ───────────────────────────────────────────────────────────────

const APP_URL = process.env.CLIENT_URL || 'https://etm-production-62a7.up.railway.app';

/**
 * Escape HTML special characters to prevent XSS in emails.
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

// In-memory cache for the recipient-locale lookup (audit-3 H5). The lookup
// hits companies + user_companies and is invoked once per email recipient
// during fan-out — without a cache, a status change with 20 stakeholders
// fires 20 separate JOIN queries. Cache TTL is short enough that an admin
// changing a company's language propagates within a minute.
const LOCALE_CACHE_TTL_MS = 60_000;
const localeCache = new Map<string, { value: ServerLocale; expiresAt: number }>();

function cacheKey(userId: string, companyId?: number | null): string {
    return `${userId}:${companyId ?? 'any'}`;
}

/**
 * Look up the language to use for a notification email destined for `userId`.
 *
 * The email is about a task that lives in a specific tenant, so the language
 * should match that tenant — NOT the recipient's personal preference. This
 * matters for two recipient categories:
 *   - "Always-receive" superadmins (Robert, Maria) who get reports across all
 *     companies. They aren't necessarily members of user_companies for the
 *     foreign tenant. An email about a Hungarian-company task should still
 *     arrive in Hungarian for them.
 *   - Regular members: same answer (the company's language).
 *
 * Priority:
 *   1. If `companyId` is provided → that company's `language` column.
 *   2. Otherwise → the language of the first company the user belongs to
 *      (legacy fallback for callers that don't know the company).
 *   3. Final fallback: 'ro'.
 */
export async function resolveRecipientLocale(
    userId: string,
    companyId?: number | null
): Promise<ServerLocale> {
    const key = cacheKey(userId, companyId);
    const cached = localeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let resolved: ServerLocale = 'ro';
    try {
        if (companyId != null) {
            const { rows } = await pool.query(
                `SELECT language FROM companies WHERE id = $1 LIMIT 1`,
                [companyId]
            );
            if (rows.length > 0) resolved = pickLocale(rows[0].language);
        } else {
            const { rows } = await pool.query(
                `SELECT c.language
                   FROM companies c
                   JOIN user_companies uc ON uc.company_id = c.id
                  WHERE uc.user_id = $1
                  ORDER BY c.id ASC
                  LIMIT 1`,
                [userId]
            );
            if (rows.length > 0) resolved = pickLocale(rows[0].language);
        }
    } catch (err: any) {
        console.warn('[NOTIF_EMAIL] resolveRecipientLocale failed:', err?.message);
    }

    localeCache.set(key, { value: resolved, expiresAt: Date.now() + LOCALE_CACHE_TTL_MS });
    // Soft cap on cache size so a long-running process doesn't grow unbounded.
    if (localeCache.size > 5000) {
        const cutoff = Date.now();
        for (const [k, v] of localeCache) {
            if (v.expiresAt < cutoff) localeCache.delete(k);
        }
    }
    return resolved;
}

/**
 * Build a standard notification email HTML.
 * All emails share the same navy header + white card + blue CTA button design.
 *
 * The wrapper (greeting, CTA label, footer) is localized via `language`.
 * `subtitle` and `bodyLines` are passed in pre-translated by the caller.
 */
export function buildNotificationHtml(params: {
    recipientName: string;
    subtitle: string;
    bodyLines: string[];        // HTML lines inside the card body
    taskId: string;
    taskTitle: string;
    ctaLabel?: string;          // defaults to translated "Open task"
    language?: ServerLocale;    // defaults to 'ro' for backward compatibility
    companyId?: number | null;  // task's tenant — frontend switches active company before opening
    commentId?: string | null;  // comment/mention/reaction emails — frontend scrolls to it
}): string {
    const {
        recipientName, subtitle, bodyLines, taskId, taskTitle,
        language = 'ro', companyId, commentId,
    } = params;
    const ctaLabel = params.ctaLabel || tServer(language, 'notif_email.cta_open_task');
    const firstName = escapeHtml(recipientName.split(' ')[0]);
    const safeSubtitle = escapeHtml(subtitle);
    const safeTaskTitle = escapeHtml(taskTitle);
    // companyId is appended so the recipient lands on the right tenant — without
    // it, a cross-tenant recipient (Robert, Maria, or anyone in multiple companies)
    // would hit a 404 when their currently-active company doesn't own the task.
    const taskUrl = `${APP_URL}/tasks?openTaskId=${encodeURIComponent(taskId)}${
        companyId != null ? `&companyId=${companyId}` : ''
    }${
        commentId ? `&commentId=${encodeURIComponent(commentId)}` : ''
    }`;

    const greeting = tServer(language, 'notif_email.greeting', { name: firstName });
    const footer = tServer(language, 'notif_email.footer');

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">ETM</h1>
        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">${safeSubtitle}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">${greeting}</p>
        ${bodyLines.join('\n')}
        <div style="background: #f0f4f8; border-left: 4px solid #2563EB; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-weight: bold; color: #1E3A5F;">${safeTaskTitle}</p>
        </div>
        <a href="${taskUrl}" target="sarcinator-app" style="display: inline-block; background: #2563EB; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-top: 8px;">
          ${ctaLabel}
        </a>
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          ${footer}
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
    companyId?: number | null;
}): Promise<void> {
    const { userId, userEmail, userName, taskId, subject, htmlBody, emailType, companyId } = params;

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

        // Log success — include company_id when known
        if (companyId != null) {
            await pool.query(
                `INSERT INTO email_logs (user_id, task_ids, email_type, status, company_id)
                 VALUES ($1, $2, $3, 'sent', $4)`,
                [userId, [taskId], emailType, companyId]
            ).catch(logErr => console.error(`[EMAIL_LOG] Failed to log success:`, logErr));
        } else {
            await pool.query(
                `INSERT INTO email_logs (user_id, task_ids, email_type, status)
                 VALUES ($1, $2, $3, 'sent')`,
                [userId, [taskId], emailType]
            ).catch(logErr => console.error(`[EMAIL_LOG] Failed to log success:`, logErr));
        }
    } catch (err: any) {
        console.error(`📧 [${emailType}] Failed to send email to ${userEmail}:`, err?.message || err);

        if (companyId != null) {
            await pool.query(
                `INSERT INTO email_logs (user_id, task_ids, email_type, status, error_message, company_id)
                 VALUES ($1, $2, $3, 'failed', $4, $5)`,
                [userId, [taskId], emailType, (err as Error).message, companyId]
            ).catch(logErr => console.error(`[EMAIL_LOG] Failed to log failure:`, logErr));
        } else {
            await pool.query(
                `INSERT INTO email_logs (user_id, task_ids, email_type, status, error_message)
                 VALUES ($1, $2, $3, 'failed', $4)`,
                [userId, [taskId], emailType, (err as Error).message]
            ).catch(logErr => console.error(`[EMAIL_LOG] Failed to log failure:`, logErr));
        }
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
    const { rows } = await pool.query(
        `SELECT DISTINCT u.id, u.email, u.display_name
         FROM users u
         WHERE u.is_active = true
           AND u.id != $2
           AND u.id IN (
             SELECT created_by FROM tasks WHERE id = $1 AND deleted_at IS NULL
             UNION
             SELECT assigned_to FROM tasks WHERE id = $1 AND assigned_to IS NOT NULL AND deleted_at IS NULL
             UNION
             SELECT assigned_to FROM subtasks WHERE task_id = $1 AND assigned_to IS NOT NULL AND deleted_at IS NULL
           )`,
        [taskId, excludeUserId]
    );
    return rows;
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
    companyId?: number | null;
    language?: ServerLocale;
}): void {
    const {
        stakeholders, taskId, taskTitle, subject, subtitle, bodyLines, emailType,
        companyId, language,
    } = params;

    for (const user of stakeholders) {
        const htmlBody = buildNotificationHtml({
            recipientName: user.display_name,
            subtitle,
            bodyLines,
            taskId,
            taskTitle,
            language,
            companyId,
        });

        sendNotificationEmail({
            userId: user.id,
            userEmail: user.email,
            userName: user.display_name,
            taskId,
            subject,
            htmlBody,
            emailType,
            companyId,
        }).catch(err => console.error(`[${emailType}] Error:`, err));
    }
}
