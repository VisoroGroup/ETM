import { formatDistanceToNow, format, isToday, isPast, isTomorrow, differenceInDays } from 'date-fns';
import { ro, hu, enUS, type Locale } from 'date-fns/locale';

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

export function getDueDateStatus(dueDate: string | Date): 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal' {
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

export function getDaysOverdue(dueDate: string | Date): number {
    if (!dueDate) return 0;
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, differenceInDays(today, d));
}

export function getDaysUntil(dueDate: string | Date): number {
    if (!dueDate) return 0;
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, differenceInDays(d, today));
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
