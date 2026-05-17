import pool from '../config/database';
import { toLocalDateStr } from './dateUtils';

// Cache of "this date is a holiday for company X". We rebuild this lazily
// per-company on first lookup and again every hour. Recurring task rollover
// runs hundreds of times per cron tick and we don't want a SELECT per call.
type HolidayCache = {
    set: Set<string>; // 'YYYY-MM-DD' keys
    expiresAt: number;
};
const cache = new Map<number, HolidayCache>();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function loadHolidays(companyId: number): Promise<Set<string>> {
    const now = Date.now();
    const hit = cache.get(companyId);
    if (hit && hit.expiresAt > now) return hit.set;

    const { rows } = await pool.query<{ holiday_date: string }>(
        `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date
           FROM company_holidays
          WHERE company_id = $1`,
        [companyId]
    );
    const set = new Set(rows.map(r => r.holiday_date));
    cache.set(companyId, { set, expiresAt: now + CACHE_TTL_MS });
    return set;
}

/**
 * Roll the given date forward until it lands on a workday for the company —
 * i.e. not a weekend and not in the company_holidays table. Mutates the
 * passed Date in place (and returns it for chaining).
 *
 * Safe guard: gives up after 30 iterations to avoid an infinite loop if some
 * tenant somehow has 30+ consecutive holidays seeded.
 */
export async function rollForwardToWorkday(date: Date, companyId: number): Promise<Date> {
    const holidays = await loadHolidays(companyId);
    let attempts = 0;
    while (attempts < 30) {
        const day = date.getDay();
        if (day === 0 || day === 6) {
            date.setDate(date.getDate() + 1);
            attempts++;
            continue;
        }
        if (holidays.has(toLocalDateStr(date))) {
            date.setDate(date.getDate() + 1);
            attempts++;
            continue;
        }
        return date;
    }
    return date;
}

/** Invalidate the in-memory cache. Call from admin endpoints that mutate
 *  company_holidays so the new entries take effect within the same process. */
export function invalidateHolidayCache(companyId?: number): void {
    if (companyId === undefined) cache.clear();
    else cache.delete(companyId);
}
