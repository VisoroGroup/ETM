import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        console.log('⚠️  SENTRY_DSN not set — Sentry disabled');
        return;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        integrations: [
            nodeProfilingIntegration(),
        ],
        // Performance tracing — 10% in production
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        profilesSampleRate: 0.1,
    });

    console.log('✅ Sentry initialized');
}

export const sentryErrorHandler = Sentry.expressErrorHandler;
export { Sentry };
