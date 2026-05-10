import cron from 'node-cron';
import pool from '../config/database';
import { sendEmail } from '../services/emailService';

// ---------------------------------------------------------------------------
// PUG stage deadline reminders
// ---------------------------------------------------------------------------
// Daily at 07:00 Europe/Bucharest, scan every non-archived project of
// `template_type = 'project'` companies. For each stage with a deadline whose
// status is not terminal, compute days-until-deadline and match against the
// company's configured pug_reminder_settings rows.
//
// Each enabled row has a `days_before` integer:
//   > 0 : fires when (deadline - today) === days_before  (e.g. 14 = two weeks before)
//   = 0 : fires on the deadline day
//   < 0 : fires |days_before| days AFTER deadline (e.g. -1 = one day past deadline)
//
// The level encoded in pug_stage_reminder_log is:
//   'd<N>'    for days_before >= 0   (e.g. 'd14', 'd7', 'd3', 'd1', 'd0')
//   'overdue' for days_before === -1 (preserves existing log rows)
//   'd<N>'    for days_before < -1   (e.g. 'd-2', 'd-7'); kept distinct so the
//             dedup row is unique per configured level.
// A row in pug_stage_reminder_log enforces single-shot delivery per
// (stage, level). Each project responsible receives both an email (in their
// company's language) and a notifications row.
// ---------------------------------------------------------------------------

type Lang = 'ro' | 'hu' | 'en';

/**
 * Map a days_before integer to the level string used in pug_stage_reminder_log.
 * Keep 'overdue' as the canonical name for days_before === -1 so that existing
 * log rows from the pre-config era remain valid.
 */
function levelKey(daysBefore: number): string {
    if (daysBefore === -1) return 'overdue';
    return `d${daysBefore}`;
}

/**
 * Whether this reminder fires for a stage that is `daysUntil` days away from
 * its deadline. days_before > 0 means "fire when there are exactly N days
 * left"; 0 means "fire on the day"; negative means "fire N days past deadline".
 */
function matchesLevel(daysUntil: number, daysBefore: number): boolean {
    return daysUntil === daysBefore;
}

interface StageRow {
    stage_id: string;
    project_id: string;
    company_id: number;
    project_title: string;
    stage_name: string;
    deadline: string;            // ISO date (yyyy-mm-dd)
    is_terminal: boolean | null; // null when status_id is NULL
    company_language: string;
    company_sidebar_name: string;
}

interface ResponsibleRow {
    user_id: string;
    email: string;
    display_name: string;
}

/**
 * Compute the calendar-day difference (deadline - today) in Europe/Bucharest.
 * Both dates are interpreted as that timezone's "today".
 */
function daysUntilBucharest(deadlineIso: string): number {
    // Build today's date in Europe/Bucharest (yyyy-mm-dd) without time.
    const today = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Bucharest',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const todayStr = fmt.format(today); // "YYYY-MM-DD"
    // Parse both as UTC midnight so the diff is integer days.
    const t = Date.parse(todayStr + 'T00:00:00Z');
    const d = Date.parse(deadlineIso.slice(0, 10) + 'T00:00:00Z');
    if (Number.isNaN(t) || Number.isNaN(d)) return NaN;
    return Math.round((d - t) / 86400000);
}

function pickLang(raw: string): Lang {
    if (raw === 'hu' || raw === 'en') return raw;
    return 'ro';
}

function formatDate(iso: string, lang: Lang): string {
    const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    if (lang === 'hu') return `${yyyy}.${mm}.${dd}.`;
    if (lang === 'en') return `${yyyy}-${mm}-${dd}`;
    return `${dd}.${mm}.${yyyy}`; // ro
}

interface Phrases {
    subject: string;
    heading: string;
    intro: string;
    daysLine: string;
    deadlineLabel: string;
    projectLabel: string;
    stageLabel: string;
    notifMessage: string;
}

function phrasesFor(opts: {
    lang: Lang;
    days: number;
    stageName: string;
    projectTitle: string;
    deadlineFormatted: string;
    displayName: string;
}): Phrases {
    const { lang, days, stageName, projectTitle, deadlineFormatted, displayName } = opts;
    const overdue = days < 0;
    const dayOf = days === 0;
    const overdueDays = Math.abs(days);
    const firstName = displayName.split(' ')[0];

    if (lang === 'hu') {
        const daysLine = overdue
            ? `Lejart hatarido: ${overdueDays} napja!`
            : dayOf
                ? `Hatarido ma jar le.`
                : `Meg ${days} nap a hataridoig.`;
        const notifMessage = overdue
            ? `${stageName} (${projectTitle}): hatarido lejart ${overdueDays} napja.`
            : dayOf
                ? `${stageName} (${projectTitle}): hatarido ma jar le.`
                : `${stageName} (${projectTitle}): meg ${days} nap a hataridoig.`;
        return {
            subject: overdue
                ? `[Sarcinator] Lejart hatarido — ${stageName} / ${projectTitle}`
                : `[Sarcinator] Hatarido emlekezteto — ${stageName} / ${projectTitle}`,
            heading: 'Sarcinator — projekt szakasz emlekezteto',
            intro: `Szia ${firstName}!`,
            daysLine,
            deadlineLabel: 'Hatarido',
            projectLabel: 'Projekt',
            stageLabel: 'Szakasz',
            notifMessage,
        };
    }

    if (lang === 'en') {
        const daysLine = overdue
            ? `Deadline overdue by ${overdueDays} day(s)!`
            : dayOf
                ? `Deadline is today.`
                : `${days} day(s) until deadline.`;
        const notifMessage = overdue
            ? `${stageName} of project ${projectTitle}: overdue by ${overdueDays} day(s).`
            : dayOf
                ? `${stageName} of project ${projectTitle}: deadline today.`
                : `${stageName} of project ${projectTitle}: ${days} day(s) left.`;
        return {
            subject: overdue
                ? `[Sarcinator] Overdue — ${stageName} / ${projectTitle}`
                : `[Sarcinator] Deadline reminder — ${stageName} / ${projectTitle}`,
            heading: 'Sarcinator — project stage reminder',
            intro: `Hi ${firstName},`,
            daysLine,
            deadlineLabel: 'Deadline',
            projectLabel: 'Project',
            stageLabel: 'Stage',
            notifMessage,
        };
    }

    // ro (default)
    const daysLine = overdue
        ? `Termen depasit cu ${overdueDays} zile!`
        : dayOf
            ? `Termenul este astazi.`
            : `Mai sunt ${days} zile pana la termen.`;
    const notifMessage = overdue
        ? `${stageName} al proiectului ${projectTitle}: termen depasit cu ${overdueDays} zile.`
        : dayOf
            ? `${stageName} al proiectului ${projectTitle}: termen astazi.`
            : `${stageName} al proiectului ${projectTitle}: ${days} zile ramase.`;
    return {
        subject: overdue
            ? `[Sarcinator] Termen depasit — ${stageName} / ${projectTitle}`
            : `[Sarcinator] Reamintire termen — ${stageName} / ${projectTitle}`,
        heading: 'Sarcinator — reamintire etapa proiect',
        intro: `Buna, ${firstName}!`,
        daysLine,
        deadlineLabel: 'Termen',
        projectLabel: 'Proiect',
        stageLabel: 'Etapa',
        notifMessage,
    };
}

function buildEmailHtml(p: {
    phrases: Phrases;
    stageName: string;
    projectTitle: string;
    deadlineFormatted: string;
    overdue: boolean;
}): string {
    const accent = p.overdue ? '#EF4444' : '#F59E0B';
    return `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
  <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 20px;">${p.phrases.heading}</h1>
  </div>
  <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">${p.phrases.intro}</p>
    <div style="border-left: 4px solid ${accent}; background: ${p.overdue ? '#fee2e2' : '#fef3c7'}; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0 0 6px; font-size: 15px; font-weight: bold; color: ${p.overdue ? '#991b1b' : '#92400e'};">${p.phrases.daysLine}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #333;"><strong>${p.phrases.projectLabel}:</strong> ${p.projectTitle}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #333;"><strong>${p.phrases.stageLabel}:</strong> ${p.stageName}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #333;"><strong>${p.phrases.deadlineLabel}:</strong> ${p.deadlineFormatted}</p>
    </div>
    <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
      Sarcinator Visoro
    </p>
  </div>
</div>`;
}

async function runPugStageReminderJob() {
    console.log('[PUG-REMIND] running daily PUG stage reminder job');
    try {
        // Fetch all candidate stages: project not archived, company is project-template,
        // stage has a deadline, status is non-terminal (or null).
        const { rows: stages } = await pool.query<StageRow>(`
            SELECT
                ps.id          AS stage_id,
                p.id           AS project_id,
                p.company_id   AS company_id,
                p.title        AS project_title,
                sc.name        AS stage_name,
                ps.deadline    AS deadline,
                st.is_terminal AS is_terminal,
                c.language     AS company_language,
                c.sidebar_name AS company_sidebar_name
            FROM pug_project_stages ps
            JOIN pug_projects p        ON p.id = ps.project_id
            JOIN companies c           ON c.id = p.company_id
            JOIN pug_stage_catalog sc  ON sc.id = ps.stage_catalog_id
            LEFT JOIN pug_status_catalog st ON st.id = ps.status_id
            WHERE p.is_archived = false
              AND c.is_archived = false
              AND c.template_type = 'project'
              AND ps.deadline IS NOT NULL
              AND (st.id IS NULL OR st.is_terminal = false)
        `);

        if (stages.length === 0) {
            console.log('[PUG-REMIND] no candidate stages found');
            return;
        }

        // Cache reminder-level configs per company (loaded lazily).
        const settingsCache = new Map<number, number[]>();
        const loadSettings = async (companyId: number): Promise<number[]> => {
            const hit = settingsCache.get(companyId);
            if (hit) return hit;
            const { rows } = await pool.query<{ days_before: number }>(
                `SELECT days_before FROM pug_reminder_settings
                  WHERE company_id = $1 AND is_enabled = true
                  ORDER BY days_before DESC`,
                [companyId]
            );
            const list = rows.map(r => Number(r.days_before));
            settingsCache.set(companyId, list);
            return list;
        };

        let sentCount = 0;
        let skippedCount = 0;

        for (const s of stages) {
            const days = daysUntilBucharest(s.deadline);
            if (Number.isNaN(days)) continue;

            const enabledLevels = await loadSettings(s.company_id);
            if (enabledLevels.length === 0) continue;

            // Find every enabled level that matches today (typically 0 or 1).
            const matched = enabledLevels.filter(d => matchesLevel(days, d));
            if (matched.length === 0) continue;

            for (const daysBefore of matched) {
                const level = levelKey(daysBefore);

                // Already sent this level for this stage?
                const { rowCount: alreadySent } = await pool.query(
                    `SELECT 1 FROM pug_stage_reminder_log WHERE project_stage_id = $1 AND level = $2`,
                    [s.stage_id, level]
                );
                if (alreadySent && alreadySent > 0) {
                    skippedCount++;
                    continue;
                }

                // Find responsibles for this project.
                const { rows: responsibles } = await pool.query<ResponsibleRow>(`
                    SELECT u.id AS user_id, u.email, u.display_name
                    FROM pug_project_responsibles pr
                    JOIN users u ON u.id = pr.user_id
                    WHERE pr.project_id = $1
                      AND u.is_active = true
                      AND u.email IS NOT NULL
                `, [s.project_id]);

                if (responsibles.length === 0) {
                    // No-one to notify — still log the level so we don't keep checking.
                    await pool.query(
                        `INSERT INTO pug_stage_reminder_log (company_id, project_stage_id, level)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (project_stage_id, level) DO NOTHING`,
                        [s.company_id, s.stage_id, level]
                    );
                    continue;
                }

                const lang = pickLang(s.company_language);
                const deadlineFormatted = formatDate(s.deadline, lang);
                const overdue = days < 0;

                for (const u of responsibles) {
                    const phrases = phrasesFor({
                        lang,
                        days,
                        stageName: s.stage_name,
                        projectTitle: s.project_title,
                        deadlineFormatted,
                        displayName: u.display_name || u.email,
                    });

                    const html = buildEmailHtml({
                        phrases,
                        stageName: s.stage_name,
                        projectTitle: s.project_title,
                        deadlineFormatted,
                        overdue,
                    });

                    // Email — only if Graph credentials configured.
                    if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID) {
                        try {
                            await sendEmail({
                                to: u.email,
                                subject: phrases.subject,
                                htmlBody: html,
                                displayName: u.display_name || undefined,
                            });
                        } catch (err: any) {
                            console.error(`[PUG-REMIND] email send failed to ${u.email}:`, err?.message);
                        }
                    } else {
                        console.log(`[PUG-REMIND] (mock — no Azure creds) would email ${u.email}: ${phrases.subject}`);
                    }

                    // In-app notification (task_id NULL because this is a stage).
                    try {
                        await pool.query(
                            `INSERT INTO notifications (user_id, task_id, type, message, created_by, company_id)
                             VALUES ($1, NULL, 'pug_stage_deadline', $2, NULL, $3)`,
                            [u.user_id, phrases.notifMessage, s.company_id]
                        );
                    } catch (err: any) {
                        console.error(`[PUG-REMIND] notification insert failed for user ${u.user_id}:`, err?.message);
                    }
                }

                // Record that this level has been sent.
                await pool.query(
                    `INSERT INTO pug_stage_reminder_log (company_id, project_stage_id, level)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (project_stage_id, level) DO NOTHING`,
                    [s.company_id, s.stage_id, level]
                );
                sentCount++;
            }
        }

        console.log(`[PUG-REMIND] done. sent=${sentCount}, skipped=${skippedCount}, candidates=${stages.length}`);
    } catch (err: any) {
        console.error('[PUG-REMIND] job failed:', err?.message || err);
    }
}

/**
 * Start the PUG stage reminder cron — daily at 07:00 Europe/Bucharest.
 */
export function startPugStageReminderScheduler() {
    cron.schedule('0 7 * * *', () => {
        runPugStageReminderJob();
    }, {
        timezone: 'Europe/Bucharest',
    });
    console.log('[PUG-REMIND] scheduler started — daily at 07:00 Europe/Bucharest');
}

// Export for manual testing
export { runPugStageReminderJob };
