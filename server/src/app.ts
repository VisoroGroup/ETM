import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load env before anything else
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import dashboardRoutes from './routes/dashboard';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profile';
import notificationRoutes from './routes/notifications';
import { startEmailScheduler } from './cron/emailScheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Visoro Task Manager API running on port ${PORT}`);
    console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Auth bypass: ${process.env.DEV_AUTH_BYPASS === 'true' ? 'ENABLED' : 'DISABLED'}`);

    // Start email scheduler
    startEmailScheduler();
});

export default app;
