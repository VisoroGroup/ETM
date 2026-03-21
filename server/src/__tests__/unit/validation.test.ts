import { createTaskSchema, createPaymentSchema, updatePaymentSchema } from '../../middleware/validation';

describe('Validation Schemas', () => {

    describe('createTaskSchema', () => {
        const validTask = {
            title: 'Test task',
            department_label: 'IT',
            due_date: '2026-04-01',
        };

        it('accepts a valid task', () => {
            const result = createTaskSchema.safeParse(validTask);
            expect(result.success).toBe(true);
        });

        it('rejects missing title', () => {
            const result = createTaskSchema.safeParse({ ...validTask, title: '' });
            expect(result.success).toBe(false);
        });

        it('rejects title over 255 chars', () => {
            const result = createTaskSchema.safeParse({ ...validTask, title: 'x'.repeat(256) });
            expect(result.success).toBe(false);
        });

        it('accepts optional description as null', () => {
            const result = createTaskSchema.safeParse({ ...validTask, description: null });
            expect(result.success).toBe(true);
        });

        it('rejects invalid assigned_to UUID', () => {
            const result = createTaskSchema.safeParse({ ...validTask, assigned_to: 'not-a-uuid' });
            expect(result.success).toBe(false);
        });

        it('accepts valid assigned_to UUID', () => {
            const result = createTaskSchema.safeParse({
                ...validTask,
                assigned_to: '550e8400-e29b-41d4-a716-446655440000'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('createPaymentSchema', () => {
        const validPayment = {
            title: 'Internet bill',
            amount: 150.50,
            category: 'furnizor_servicii',
            due_date: '2026-04-01',
        };

        it('accepts a valid payment', () => {
            const result = createPaymentSchema.safeParse(validPayment);
            expect(result.success).toBe(true);
        });

        it('rejects missing title', () => {
            const result = createPaymentSchema.safeParse({ ...validPayment, title: '' });
            expect(result.success).toBe(false);
        });

        it('rejects negative amount', () => {
            const result = createPaymentSchema.safeParse({ ...validPayment, amount: -100 });
            expect(result.success).toBe(false);
        });

        it('rejects zero amount', () => {
            const result = createPaymentSchema.safeParse({ ...validPayment, amount: 0 });
            expect(result.success).toBe(false);
        });

        it('rejects invalid category', () => {
            const result = createPaymentSchema.safeParse({ ...validPayment, category: 'invalid_cat' });
            expect(result.success).toBe(false);
        });

        it('accepts all valid categories', () => {
            const categories = ['stat', 'partener_furnizor', 'furnizor_servicii', 'furnizor_echipamente', 'marketing', 'salarii'];
            for (const category of categories) {
                const result = createPaymentSchema.safeParse({ ...validPayment, category });
                expect(result.success).toBe(true);
            }
        });

        it('defaults currency to RON', () => {
            const result = createPaymentSchema.safeParse(validPayment);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.currency).toBe('RON');
            }
        });

        it('defaults is_recurring to false', () => {
            const result = createPaymentSchema.safeParse(validPayment);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is_recurring).toBe(false);
            }
        });
    });

    describe('updatePaymentSchema', () => {
        it('accepts partial updates', () => {
            const result = updatePaymentSchema.safeParse({ title: 'Updated title' });
            expect(result.success).toBe(true);
        });

        it('accepts empty body (all fields optional)', () => {
            const result = updatePaymentSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('still validates field types on partial update', () => {
            const result = updatePaymentSchema.safeParse({ amount: -50 });
            expect(result.success).toBe(false);
        });
    });
});
