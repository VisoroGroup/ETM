import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { tError } from '../utils/serverErrors';

// Async handler wrapper — eliminates try-catch boilerplate in route handlers
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

// Global error handler — register AFTER all routes in app.ts
export const globalErrorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
    Sentry.captureException(err);
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    if (err.name === 'ValidationError' || err.message.includes('invalid input')) {
        res.status(400).json({ error: err.message });
        return;
    }

    res.status(500).json({ error: tError(req, 'internal_server') });
};
