import { formatDistanceToNow, format, isToday, isPast, isTomorrow, differenceInDays } from 'date-fns';
import { ro, hu, enUS, type Locale } from 'date-fns/locale';
import type { RecurringFrequency } from '../types';

// Active date-fns locale. Defaults to RO (the legacy default), and is
// switched at runtime by I18nProvider when the active company's language
// changes. Module-level state so plain-function callers (timeAgo, formatDate,
// ...) don't all need to become hooks.
const LOCALES: Record<string, Locale> = { ro, hu, en: enUS };
let activeLocale: Locale = ro;

export function setDateLocale(lang: 'ro' | 'hu' | 'en'): void {
    activeLocale = LOCALES[lang] ?? ro;
}

export function timeAgo(date: string | Date): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: activeLocale });
}

export function formatDate(date: string | Date): string {
    return format(new Date(date), 'd MMM yyyy', { locale: activeLocale });
}

export function formatDateFull(date: string | Date): string {
    return format(new Date(date), 'd MMMM yyyy', { locale: activeLocale });
}

export function getDueDateStatus(dueDate: string | Date | null | undefined): 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal' {
    if (!dueDate) return 'normal';
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(d) && !isToday(d)) return 'overdue';
    if (isToday(d)) return 'today';
    if (isTomorrow(d)) return 'tomorrow';

    const diff = differenceInDays(d, today);
    if (diff <= 3) return 'soon';
    return 'normal';
}

export function getDaysOverdue(dueDate: string | Date | null | undefined): number {
    if (!dueDate) return 0;
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, differenceInDays(today, d));
}

export function getDaysUntil(dueDate: string | Date | null | undefined): number {
    if (!dueDate) return 0;
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, differenceInDays(d, today));
}

// --- Recurring "next occurrence" display --------------------------------
//
// A recurring task's stored due_date only moves forward when the task is marked
// terminat (a new task is spawned then). Until then an unfinished recurring task
// keeps showing its original date as "overdue", which nags for routines that are
// simply due again next cycle. getEffectiveDueDate rolls the DISPLAYED date
// forward to the next upcoming occurrence so badges show "due <next date>"
// instead of "depășit". It never mutates the task or the stored date.

// Non-working days for the active company ('YYYY-MM-DD'), loaded once per
// company by Layout via setHolidays(). Mirrors the server's company_holidays so
// a workdays_only recurring task lands on the same workday in the badge as it
// will in reality.
let holidaySet: Set<string> = new Set();

export function setHolidays(dates: string[]): void {
    holidaySet = new Set(dates);
}

function toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function isWorkday(d: Date): boolean {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false; // Sat/Sun
    return !holidaySet.has(toYmd(d));
}

function advanceByFrequency(d: Date, freq: RecurringFrequency): void {
    switch (freq) {
        case 'daily': d.setDate(d.getDate() + 1); break;
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'biweekly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    }
}

// Minimal shape needed to compute the effective due date — both list `Task` and
// `TaskDetail` satisfy it.
interface RecurringDueInfo {
    due_date?: string | null;
    is_recurring?: boolean;
    recurring_frequency?: RecurringFrequency;
    recurring_workdays_only?: boolean;
    status?: string;
}

/**
 * For an ACTIVE recurring task whose due date has already passed, return the
 * next upcoming occurrence date (rolled forward by the frequency, and — when the
 * rule is workdays_only — snapped to the next workday exactly like the server).
 * For everything else (non-recurring, completed, or still due today/future) the
 * stored due_date is returned unchanged. Display-only; does not mutate the task.
 */
export function getEffectiveDueDate(task: RecurringDueInfo): string | Date | null | undefined {
    const due = task.due_date;
    if (!due || !task.is_recurring || !task.recurring_frequency || task.status === 'terminat') {
        return due;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(due);
    d.setHours(0, 0, 0, 0);
    if (d >= today) return due; // due today or in the future — leave as-is

    // Roll forward whole periods until we reach today or later, snapping to a
    // workday after each step when the rule requires it. The 520-step guard caps
    // a daily task at ~1.5 years of backlog so a corrupt row can't hang the UI.
    let guard = 0;
    while (d < today && guard < 520) {
        advanceByFrequency(d, task.recurring_frequency);
        if (task.recurring_workdays_only) {
            let wg = 0;
            while (!isWorkday(d) && wg < 30) { d.setDate(d.getDate() + 1); wg++; }
        }
        guard++;
    }
    return d;
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
