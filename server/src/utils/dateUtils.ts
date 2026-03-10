/**
 * Working days utility functions for email reminder calculations
 * Follows Romanian business calendar (Mon-Fri)
 */

/**
 * Check if a date is a working day (Monday-Friday)
 */
export function isWorkingDay(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Mon=1, Fri=5
}

/**
 * Get the next working day from a given date
 */
export function getNextWorkingDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (!isWorkingDay(next)) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

/**
 * Subtract N working days from a date
 * E.g., subtractWorkingDays(Thursday, 4) = previous Friday
 */
export function subtractWorkingDays(date: Date, days: number): Date {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        result.setDate(result.getDate() - 1);
        if (isWorkingDay(result)) {
            remaining--;
        }
    }
    return result;
}

/**
 * Get difference in calendar days between two dates
 */
export function daysDiff(a: Date, b: Date): number {
    const msPerDay = 86400000;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utcB - utcA) / msPerDay);
}

/**
 * Check if today matches any reminder phase for a given deadline
 *
 * Phase 1 (>7 days): Monday weekly reminder
 * Phase 2 (≤7 days): 4, 2, 1 working days before deadline
 * Phase 3 (overdue): daily working day reminder
 */
export function shouldSendReminder(today: Date, dueDate: Date): { send: boolean; phase: string } {
    const diff = daysDiff(today, dueDate);

    // Phase 3: Overdue
    if (diff < 0) {
        if (isWorkingDay(today)) {
            return { send: true, phase: 'overdue' };
        }
        return { send: false, phase: 'overdue' };
    }

    // Phase 2: Last 7 days
    if (diff <= 7) {
        // Check if today is 4, 2, or 1 working days before deadline
        const fourBefore = subtractWorkingDays(dueDate, 4);
        const twoBefore = subtractWorkingDays(dueDate, 2);
        const oneBefore = subtractWorkingDays(dueDate, 1);

        const todayStr = today.toISOString().split('T')[0];
        const dueDateStr = dueDate.toISOString().split('T')[0];

        if (todayStr === fourBefore.toISOString().split('T')[0]) {
            return { send: true, phase: '4_days_before' };
        }
        if (todayStr === twoBefore.toISOString().split('T')[0]) {
            return { send: true, phase: '2_days_before' };
        }
        if (todayStr === oneBefore.toISOString().split('T')[0]) {
            return { send: true, phase: '1_day_before' };
        }
        if (todayStr === dueDateStr) {
            return { send: true, phase: 'due_today' };
        }

        return { send: false, phase: 'last_7_days' };
    }

    // Phase 1: More than 7 days — Monday weekly reminder
    if (today.getDay() === 1) { // Monday
        return { send: true, phase: 'weekly' };
    }

    return { send: false, phase: 'more_than_7_days' };
}

/**
 * Format date for display in Romanian style
 */
export function formatDateRo(date: Date | string): string {
    const d = new Date(date);
    const months = [
        'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
        'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
