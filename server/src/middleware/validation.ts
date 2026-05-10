import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

function validate<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Date invalide',
                details: result.error.errors.map((e: z.ZodIssue) => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            });
        }
        req.body = result.data;
        next();
    };
}

export const createTaskSchema = z.object({
    title: z.string().min(1, 'Titlul este obligatoriu').max(255),
    description: z.string().nullable().optional(),
    department_label: z.string().min(1),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formátum szükséges'),
    assigned_to: z.string().uuid().nullable().optional(),
    // Exactly ONE of the three scopes must be set — enforced in .refine() below.
    assigned_post_id: z.string().uuid().nullable().optional(),
    assigned_section_id: z.string().uuid().nullable().optional(),
    assigned_department_id: z.string().uuid().nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    is_recurring: z.boolean().optional(),
    recurring_interval: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
}).refine(
    (d) => {
        // Template-aware design: Zod middleware can only check the shape of
        // the payload — it cannot run a DB lookup to know the active
        // company's template_type. So this layer enforces the *upper bound*
        // (at most one of post / section / department), and the route
        // handler in tasks.ts enforces the template-specific rule:
        //   - 'full' (Visoro Global): exactly one scope is required
        //   - 'simple' / 'project': zero scopes allowed (no org structure)
        // Keeping the rule at the route handler keeps middleware stateless.
        const set = [d.assigned_post_id, d.assigned_section_id, d.assigned_department_id].filter(Boolean).length;
        return set <= 1;
    },
    { message: 'Alege cel mult unul: post, subdepartament sau departament', path: ['assigned_post_id'] }
);

export const updateTaskSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    department_label: z.string().optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formátum szükséges').optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    assigned_post_id: z.string().uuid().nullable().optional(),
    assigned_section_id: z.string().uuid().nullable().optional(),
    assigned_department_id: z.string().uuid().nullable().optional(),
    is_recurring: z.boolean().optional(),
    recurring_interval: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
});

export const changeStatusSchema = z.object({
    status: z.enum(['de_rezolvat', 'in_realizare', 'blocat', 'terminat']),
    reason: z.string().optional(),
});

export const createCommentSchema = z.object({
    content: z.string().min(1, 'Comentariul nu poate fi gol').max(5000),
    mentions: z.array(z.string().uuid()).optional().default([]),
    parent_comment_id: z.string().uuid().nullable().optional().default(null),
});

export const createTemplateSchema = z.object({
    title: z.string().min(1, 'Titlul este obligatoriu').max(255),
    description: z.string().optional(),
    department_label: z.string().min(1),
    assigned_to: z.string().uuid().nullable().optional(),
    subtasks: z.array(z.object({ title: z.string().min(1) })).optional().default([]),
});

export const validateCreateTask = validate(createTaskSchema);
export const validateUpdateTask = validate(updateTaskSchema);
export const validateChangeStatus = validate(changeStatusSchema);
export const validateCreateComment = validate(createCommentSchema);
export const validateCreateTemplate = validate(createTemplateSchema);

