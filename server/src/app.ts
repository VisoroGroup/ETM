import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import pool from './config/database';

// Load env before anything else
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

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
import { globalLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter';
import { startEmailScheduler } from './cron/emailScheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's reverse proxy (fixes express-rate-limit X-Forwarded-For error)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limit
app.use('/api', globalLimiter);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// Routes (auth + upload get stricter limits)
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/templates', templatesRoutes);

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

// Sentry error handler — must be AFTER all routes
if (process.env.SENTRY_DSN) {
    app.use(sentryErrorHandler());
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Visoro Task Manager API running on port ${PORT}`);
    console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Auth bypass: ${process.env.DEV_AUTH_BYPASS === 'true' ? 'ENABLED' : 'DISABLED'}`);

    // Start email scheduler
    startEmailScheduler();
});

export default app;
