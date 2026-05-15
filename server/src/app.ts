// Load env FIRST — before any other import that reads process.env
import './env';
import { tError } from './utils/serverErrors';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import pool from './config/database';
import { runMigrations } from './database/migrate';
import { startWebhookRetryProcessor } from './services/webhookService';

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
import savedFiltersRoutes from './routes/savedFilters';
import activityFeedRoutes from './routes/activityFeed';
import reportsRoutes from './routes/reports';
import webhookRoutes from './routes/webhooks';
import dayViewRoutes from './routes/dayView';
import externalApiRoutes from './routes/externalApi';
import filesRoutes from './routes/files';
import userPreferencesRoutes from './routes/userPreferences';
import departmentRoutes from './routes/departments';
import policyRoutes from './routes/policies';
import settingsRoutes from './routes/settings';
import searchRoutes from './routes/search';
import orphanTasksRoutes from './routes/orphanTasks';
import companiesRoutes from './routes/companies';
import adminCompaniesRoutes from './routes/adminCompanies';
import pugAdminRoutes from './routes/pugAdmin';
import pugProjectsRoutes from './routes/pugProjects';
import { globalLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter';
import { globalErrorHandler } from './middleware/errorHandler';
import { startEmailScheduler } from './cron/emailScheduler';
import { startPugStageReminderScheduler } from './cron/pugStageReminders';

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

// File serving from PostgreSQL (persistent across deploys)
app.use('/api/files', filesRoutes);

// NOTE (security): the legacy /uploads and /uploads/avatars static mounts have been
// removed. They served raw filesystem files by basename, with no tenant scoping —
// any logged-in user could fetch any company's attachments, and avatars were
// publicly listable. All binary content now lives in PostgreSQL and is served by
// /api/files/* (see routes/files.ts), which enforces auth + company scoping.
// Old /uploads/* and /uploads/avatars/* URLs intentionally 404 by design — there
// is no safe way to keep them working alongside multi-tenant storage.

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
app.use('/api/saved-filters', savedFiltersRoutes);
app.use('/api/activity-feed', activityFeedRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/day-view', dayViewRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/orphan-tasks', orphanTasksRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/admin/companies', adminCompaniesRoutes);
app.use('/api/admin/pug', pugAdminRoutes);
app.use('/api/pug/projects', pugProjectsRoutes);
app.use('/api/v1', externalApiRoutes);
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
    // Static assets get long-lived caching by default. We override only for
    // index.html (the entry point that references all the hashed chunks) —
    // it MUST be re-fetched on every load so the browser picks up the new
    // chunk hashes after a deploy. Otherwise stale index.html references
    // chunks that no longer exist and the SPA falls through to the catch-all
    // below, getting index.html for a `.js` request and a MIME-type error.
    app.use(express.static(clientBuildPath, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('index.html')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
        },
    }));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            res.status(404).json({ error: tError(req, 'api_endpoint_not_found') });
            return;
        }
        // Paths ending in a file extension (e.g. /assets/app.abc123.js,
        // /favicon.ico) must NOT fall through to index.html — that's what
        // produces the "'text/html' is not a valid JavaScript MIME type"
        // browser error when a cached index.html references a now-stale
        // hashed bundle. Return 404 so the browser knows to refetch.
        if (path.extname(req.path)) {
            res.status(404).end();
            return;
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
const server = app.listen(PORT, async () => {
    console.log(`🚀 Sarcinator Visoro API running on port ${PORT}`);
    console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Auth bypass: ${process.env.DEV_AUTH_BYPASS === 'true' ? 'ENABLED' : 'DISABLED'}`);

    // Run pending migrations
    try {
        await runMigrations();
    } catch (err) {
        console.error('⚠️  Migration error (non-fatal):', err);
    }

    // Ensure superadmin role exists and owner is set (idempotent, runs every boot)
    try {
        const client = await pool.connect();
        try {
            // Step 1: Add superadmin to enum if not exists
            try {
                await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin'`);
                console.log('✅ superadmin enum value ensured');
            } catch (enumErr: any) {
                // Already exists is fine
                if (enumErr?.message?.includes('already exists')) {
                    console.log('✅ superadmin enum value already exists');
                } else {
                    console.error('⚠️ ALTER TYPE error:', enumErr?.message);
                }
            }

            // Step 2: Set owner as superadmin
            const { rowCount } = await client.query(
                `UPDATE users SET role = 'superadmin' WHERE email = 'ledenyi.robert@visoro-global.ro' AND role != 'superadmin'`
            );
            if (rowCount && rowCount > 0) {
                console.log('✅ Owner account set to superadmin');
            } else {
                console.log('ℹ️  Owner already superadmin or not found');
            }

            // Step 3: Ensure comment_reactions table exists
            await client.query(`
                CREATE TABLE IF NOT EXISTS comment_reactions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    reaction VARCHAR(20) NOT NULL DEFAULT '👍',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(comment_id, user_id, reaction)
                )
            `);
            console.log('✅ comment_reactions table ensured');

            // Step 4: Ensure ALL action_type enum values exist
            const requiredActionTypes = [
                'checklist_updated', 'description_changed', 'task_deleted',
                'dependency_added', 'dependency_removed', 'dependency_resolved',
                'alert_added', 'alert_resolved', 'title_changed',
                'assigned_to_changed', 'department_changed',
                'task_created', 'task_duplicated', 'attachment_read'
            ];
            for (const val of requiredActionTypes) {
                try {
                    await client.query(`ALTER TYPE action_type ADD VALUE IF NOT EXISTS '${val}'`);
                } catch {}
            }
            console.log('✅ all action_type enum values ensured');

            // Step 5: Ensure quarterly + yearly recurring_frequency exists
            try {
                await client.query(`ALTER TYPE recurring_frequency ADD VALUE IF NOT EXISTS 'quarterly'`);
                await client.query(`ALTER TYPE recurring_frequency ADD VALUE IF NOT EXISTS 'yearly'`);
                console.log('✅ recurring_frequency quarterly/yearly ensured');
            } catch (enumErr: any) {
                if (enumErr?.message?.includes('already exists')) {
                    console.log('✅ recurring_frequency quarterly/yearly already exists');
                } else {
                    console.error('⚠️ recurring_frequency ALTER error:', enumErr?.message);
                }
            }

            // Step 6: Add parent_comment_id for reply threading
            try {
                await client.query(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE`);
                console.log('✅ parent_comment_id column ensured');
            } catch { console.log('ℹ️  parent_comment_id column already exists'); }

            // Step 7: Ensure persistent file storage columns exist
            try {
                await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data BYTEA`);
                await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime VARCHAR(50)`);
                await client.query(`ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_data BYTEA`);
                await client.query(`ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100)`);
                console.log('✅ persistent file storage columns ensured');
            } catch (colErr: any) {
                console.error('⚠️ file storage columns error:', colErr?.message);
            }
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('⚠️  Startup setup error (non-fatal):', err?.message);
    }

    // Start email scheduler
    startEmailScheduler();

    // Start PUG stage deadline reminder scheduler
    startPugStageReminderScheduler();

    // Start webhook retry processor (DB-based, survives restarts)
    startWebhookRetryProcessor();
});

// Graceful shutdown — close server and DB pool on termination signals
const shutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received — shutting down gracefully...`);
    server.close(() => {
        console.log('✅ HTTP server closed');
    });
    try {
        await pool.end();
        console.log('✅ Database pool closed');
    } catch (err) {
        console.error('⚠️  Error closing database pool:', err);
    }
    // Force exit after 10 seconds if connections don't close
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
