import { isWorkingDay, getNextWorkingDay, subtractWorkingDays, daysDiff, shouldSendReminder, formatDateRo } from '../../utils/dateUtils';

describe('dateUtils', () => {

    describe('isWorkingDay', () => {
        it('returns true for Monday through Friday', () => {
            // 2026-03-16 is Monday
            expect(isWorkingDay(new Date('2026-03-16'))).toBe(true);
            expect(isWorkingDay(new Date('2026-03-17'))).toBe(true); // Tue
            expect(isWorkingDay(new Date('2026-03-18'))).toBe(true); // Wed
            expect(isWorkingDay(new Date('2026-03-19'))).toBe(true); // Thu
            expect(isWorkingDay(new Date('2026-03-20'))).toBe(true); // Fri
        });

        it('returns false for Saturday and Sunday', () => {
            expect(isWorkingDay(new Date('2026-03-21'))).toBe(false); // Sat
            expect(isWorkingDay(new Date('2026-03-22'))).toBe(false); // Sun
        });
    });

    describe('getNextWorkingDay', () => {
        it('returns next day if current day is Mon-Thu', () => {
            const monday = new Date('2026-03-16');
            const next = getNextWorkingDay(monday);
            expect(next.toISOString().split('T')[0]).toBe('2026-03-17'); // Tuesday
        });

        it('skips weekend if current day is Friday', () => {
            const friday = new Date('2026-03-20');
            const next = getNextWorkingDay(friday);
            expect(next.toISOString().split('T')[0]).toBe('2026-03-23'); // Monday
        });

        it('skips to Monday if current day is Saturday', () => {
            const saturday = new Date('2026-03-21');
            const next = getNextWorkingDay(saturday);
            expect(next.toISOString().split('T')[0]).toBe('2026-03-23'); // Monday
        });
    });

    describe('subtractWorkingDays', () => {
        it('subtracts working days correctly within a week', () => {
            const thursday = new Date('2026-03-19');
            const result = subtractWorkingDays(thursday, 2);
            expect(result.toISOString().split('T')[0]).toBe('2026-03-17'); // Tuesday
        });

        it('skips weekends when subtracting', () => {
            const tuesday = new Date('2026-03-17');
            const result = subtractWorkingDays(tuesday, 2);
            expect(result.toISOString().split('T')[0]).toBe('2026-03-13'); // Friday (skips weekend)
        });

        it('returns same date when subtracting 0 days', () => {
            const date = new Date('2026-03-18');
            const result = subtractWorkingDays(date, 0);
            expect(result.toISOString().split('T')[0]).toBe('2026-03-18');
        });
    });

    describe('daysDiff', () => {
        it('returns positive for future dates', () => {
            const today = new Date('2026-03-16');
            const future = new Date('2026-03-20');
            expect(daysDiff(today, future)).toBe(4);
        });

        it('returns negative for past dates', () => {
            const today = new Date('2026-03-20');
            const past = new Date('2026-03-16');
            expect(daysDiff(today, past)).toBe(-4);
        });

        it('returns 0 for same date', () => {
            const date = new Date('2026-03-16');
            expect(daysDiff(date, date)).toBe(0);
        });
    });

    describe('shouldSendReminder', () => {
        it('sends overdue reminder on working days', () => {
            const monday = new Date('2026-03-23');
            const pastDue = new Date('2026-03-20');
            const result = shouldSendReminder(monday, pastDue);
            expect(result.send).toBe(true);
            expect(result.phase).toBe('overdue');
        });

        it('does NOT send overdue reminder on weekends', () => {
            const saturday = new Date('2026-03-21');
            const pastDue = new Date('2026-03-20');
            const result = shouldSendReminder(saturday, pastDue);
            expect(result.send).toBe(false);
            expect(result.phase).toBe('overdue');
        });

        it('sends weekly reminder on Mondays when >7 days out', () => {
            const monday = new Date('2026-03-16');
            const farDue = new Date('2026-04-15');
            const result = shouldSendReminder(monday, farDue);
            expect(result.send).toBe(true);
            expect(result.phase).toBe('weekly');
        });

        it('does NOT send weekly reminder on non-Mondays when >7 days out', () => {
            const wednesday = new Date('2026-03-18');
            const farDue = new Date('2026-04-15');
            const result = shouldSendReminder(wednesday, farDue);
            expect(result.send).toBe(false);
        });

        it('sends reminder on due date', () => {
            const dueDate = new Date('2026-03-20');
            const result = shouldSendReminder(dueDate, dueDate);
            expect(result.send).toBe(true);
            expect(result.phase).toBe('due_today');
        });
    });

    describe('formatDateRo', () => {
        it('formats a date in Romanian style', () => {
            const result = formatDateRo(new Date('2026-03-15'));
            expect(result).toBe('15 martie 2026');
        });

        it('accepts string input', () => {
            const result = formatDateRo('2026-01-01');
            expect(result).toBe('1 ianuarie 2026');
        });

        it('handles December correctly', () => {
            const result = formatDateRo('2026-12-25');
            expect(result).toBe('25 decembrie 2026');
        });
    });
});
