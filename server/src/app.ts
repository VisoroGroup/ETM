// Load env FIRST — before any other import that reads process.env
import './env';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import pool from './config/database';
import { runMigrations } from './database/migrate';

// Init Sentry ASAP (before other imports so it can instrument them)
import { initSentry, sentryErrorHandler } from './config/sentry';
initSentry();

import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import dashboardRoutes from './routes/dashboard';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profile';
import notificationRoutes from './routes/notifications';
import emailRoutes from './routes/emails';
import templatesRoutes from './routes/templates';
import paymentsRoutes from './routes/payments';
import savedFiltersRoutes from './routes/savedFilters';
import activityFeedRoutes from './routes/activityFeed';
import reportsRoutes from './routes/reports';
import webhookRoutes from './routes/webhooks';
import { globalLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import { globalErrorHandler } from './middleware/errorHandler';
import { startEmailScheduler } from './cron/emailScheduler';
import { startPaymentEmailScheduler } from './cron/paymentScheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's reverse proxy (fixes express-rate-limit X-Forwarded-For error)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: (() => {
        if (process.env.NODE_ENV === 'production') {
            if (!process.env.CLIENT_URL) {
                console.warn('⚠️ CLIENT_URL is not set in production! CORS will block all cross-origin requests.');
                return false;
            }
            return process.env.CLIENT_URL;
        }
        return process.env.CLIENT_URL || 'http://localhost:5173';
    })(),
    credentials: true
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limit
app.use('/api', globalLimiter);

// Static file serving for uploads
app.use('/uploads', authMiddleware, express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// Routes (auth + upload get stricter limits)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/saved-filters', savedFiltersRoutes);
app.use('/api/activity-feed', activityFeedRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/webhooks', webhookRoutes);
// Health check (enhanced)
app.get('/api/health', async (_req, res) => {
    let dbOk = false;
    try {
        await pool.query('SELECT 1');
        dbOk = true;
    } catch {}
    const mem = process.memoryUsage();
    const status = dbOk ? 'ok' : 'degraded';
    res.status(dbOk ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: dbOk ? 'connected' : 'disconnected',
        memory: {
            rss: Math.round(mem.rss / 1024 / 1024) + ' MB',
            heap: Math.round(mem.heapUsed / 1024 / 1024) + ' MB'
        },
        version: '1.0.0'
    });
});

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
    const clientBuildPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientBuildPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            res.status(404).json({ error: 'API endpoint not found' });
            return;
        }
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
}

// Global error handler — catches errors from asyncHandler-wrapped routes
app.use(globalErrorHandler);

// Sentry error handler — must be AFTER all routes
if (process.env.SENTRY_DSN) {
    app.use(sentryErrorHandler());
}

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Visoro Task Manager API running on port ${PORT}`);
    console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Auth bypass: ${process.env.DEV_AUTH_BYPASS === 'true' ? 'ENABLED' : 'DISABLED'}`);

    // Run pending migrations
    try {
        await runMigrations();
    } catch (err) {
        console.error('⚠️  Migration error (non-fatal):', err);
    }

    // Start email scheduler
    startEmailScheduler();
    startPaymentEmailScheduler();
});

export default app;
