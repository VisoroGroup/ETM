import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

// Async handler wrapper — eliminates try-catch boilerplate in route handlers
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

// Global error handler — register AFTER all routes in app.ts
export const globalErrorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    Sentry.captureException(err);
    console.error(`[ERROR] ${_req.method} ${_req.path}:`, err.message);

    if (err.name === 'ValidationError' || err.message.includes('invalid input')) {
        res.status(400).json({ error: err.message });
        return;
    }

    res.status(500).json({ error: 'Szerverhiba. Kérjük próbálja újra később.' });
};
