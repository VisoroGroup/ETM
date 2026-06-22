import cron from 'node-cron';
import pool from '../config/database';
import { getDayOfWeek, toLocalDateStr } from '../utils/dateUtils';
import { withCronLock } from './cronLock';

// ---------------------------------------------------------------------------
// Planner rollover
// ---------------------------------------------------------------------------
// Unfinished planned items roll forward so a user's plan is never silently
// emptied at a period boundary (PRP 004, decision 4).
//
//   * WEEKLY (every Monday): take last week's scope='week' rows whose task is
//     still not 'terminat' (and not soft-deleted) and copy them into THIS
//     week's plan (period_start = this Monday). Finished tasks are left behind.
//   * MONTHLY (on the 1st): take last month's DIRECT scope='month' rows (same
//     not-terminat / not-deleted filter) and copy them into this month.
//     Weekly picks are NOT rolled at month level — they already surface in the
//     month view by computation (migration 094), so rolling the weeks forward
//     is enough.
//
// Both carries are set-based INSERT ... SELECT with ON CONFLICT DO NOTHING, so
// they are idempotent: re-running the same day inserts nothing new.
//
// The job ticks once a day (early morning) and decides internally which carry
// applies for today — mirrors emailScheduler/pugStageReminders, which run on a
// single schedule and branch on the date.
// ---------------------------------------------------------------------------

// Monday of the week containing `date`, as YYYY-MM-DD in the app timezone.
function mondayOf(date: Date): string {
    const dow = getDayOfWeek(date); // 0=Sun..6=Sat (app tz)
    const offsetToMonday = dow === 0 ? -6 : 1 - dow; // back up to Monday
    const monday = new Date(date);
    monday.setDate(monday.getDate() + offsetToMonday);
    return toLocalDateStr(monday);
}

// Shift a YYYY-MM-DD string by `days` and return YYYY-MM-DD.
function shiftDays(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    return toLocalDateStr(new Date(y, m - 1, d + days));
}

// First-of-month for a YYYY-MM-DD string and `monthsDelta` away, as YYYY-MM-DD.
function firstOfMonth(ymd: string, monthsDelta: number): string {
    const [y, m] = ymd.split('-').map(Number);
    return toLocalDateStr(new Date(y, m - 1 + monthsDelta, 1));
}

// Carry unfinished week items from the previous week into the current week.
// Returns the number of rows inserted.
async function rollWeekly(thisMonday: string): Promise<number> {
    const prevMonday = shiftDays(thisMonday, -7);
    const { rowCount } = await pool.query(
        `INSERT INTO planned_tasks (task_id, user_id, company_id, scope, period_start, rolled_over)
         SELECT pt.task_id, pt.user_id, pt.company_id, 'week', $1::date, true
           FROM planned_tasks pt
           JOIN tasks t ON t.id = pt.task_id AND t.company_id = pt.company_id
          WHERE pt.scope = 'week'
            AND pt.period_start = $2::date
            AND t.deleted_at IS NULL
            AND t.status <> 'terminat'
         ON CONFLICT (user_id, task_id, scope, period_start) DO NOTHING`,
        [thisMonday, prevMonday]
    );
    return rowCount ?? 0;
}

// Carry unfinished DIRECT month items from the previous month into this month.
// Returns the number of rows inserted.
async function rollMonthly(thisFirst: string): Promise<number> {
    const prevFirst = firstOfMonth(thisFirst, -1);
    const { rowCount } = await pool.query(
        `INSERT INTO planned_tasks (task_id, user_id, company_id, scope, period_start, rolled_over)
         SELECT pt.task_id, pt.user_id, pt.company_id, 'month', $1::date, true
           FROM planned_tasks pt
           JOIN tasks t ON t.id = pt.task_id AND t.company_id = pt.company_id
          WHERE pt.scope = 'month'
            AND pt.period_start = $2::date
            AND t.deleted_at IS NULL
            AND t.status <> 'terminat'
         ON CONFLICT (user_id, task_id, scope, period_start) DO NOTHING`,
        [thisFirst, prevFirst]
    );
    return rowCount ?? 0;
}

// Run the rollover pass for `today` (app timezone). Weekly carry on Mondays,
// monthly carry on the 1st. Exported for manual testing / cron trigger.
async function runPlannerRolloverJob(today: Date = new Date()): Promise<void> {
    try {
        const todayStr = toLocalDateStr(today);
        const dow = getDayOfWeek(today);
        const dayOfMonth = Number(todayStr.split('-')[2]);

        if (dow === 1) {
            const inserted = await rollWeekly(mondayOf(today));
            console.log(`[PLANNER-ROLL] weekly carry: ${inserted} item(s) rolled forward`);
        }
        if (dayOfMonth === 1) {
            const inserted = await rollMonthly(firstOfMonth(todayStr, 0));
            console.log(`[PLANNER-ROLL] monthly carry: ${inserted} item(s) rolled forward`);
        }
    } catch (err: any) {
        console.error('[PLANNER-ROLL] job failed:', err?.message || err);
    }
}

/**
 * Start the planner rollover cron — daily at 02:00 Europe/Bucharest. The job
 * itself decides whether the weekly and/or monthly carry runs for that date.
 * Runs at 02:00 so a rolled-forward plan is already in place before users
 * (and the 07:00 daily email) look at the new period.
 */
export function startPlannerRolloverScheduler(): void {
    cron.schedule('0 2 * * *', () => {
        // Advisory lock so only one replica runs the carry on a multi-replica deploy.
        withCronLock(91003, 'planner_rollover_job', () => runPlannerRolloverJob())
            .catch((err) => console.error('[PLANNER-ROLL] lock/run error:', err));
    }, {
        timezone: 'Europe/Bucharest',
    });
    console.log('[PLANNER-ROLL] scheduler started — daily at 02:00 Europe/Bucharest');
}

// Export for manual testing.
export { runPlannerRolloverJob };
