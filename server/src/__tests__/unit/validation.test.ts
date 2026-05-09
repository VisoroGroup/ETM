import { createTaskSchema } from '../../middleware/validation';

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
});
