import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import { WebhookEventType, WebhookPayload } from '../types';
import { validateWebhookUrlAsync } from '../utils/urlSafety';

const RETRY_DELAYS = [10_000, 60_000, 300_000]; // 10s, 1min, 5min
const DELIVERY_TIMEOUT = 10_000; // 10s timeout per request

// --- Central dispatch ---
export async function dispatchWebhook(
    eventType: WebhookEventType,
    data: Record<string, any>
): Promise<void> {
    // Tenant isolation: derive company_id from the payload so we only fan out
    // this event to subscriptions belonging to the same company. Without this,
    // a webhook subscribed by company A would receive task events from company B.
    const companyId =
        (data as any)?.task?.company_id ??
        (data as any)?.company_id ??
        null;

    if (companyId === null || companyId === undefined) {
        console.warn(
            `[WEBHOOK] Refusing to dispatch '${eventType}' — payload has no company_id (task.company_id / company_id). Dropping to prevent cross-tenant leak.`
        );
        return;
    }

    // 1. Get active subscriptions for this event, scoped to the originating company
    const { rows: subscriptions } = await pool.query(
        `SELECT id, url, secret FROM webhook_subscriptions
         WHERE event_type = $1 AND company_id = $2 AND is_active = true`,
        [eventType, companyId]
    );

    if (subscriptions.length === 0) return;

    // 2. Build payload
    const payload: WebhookPayload = {
        id: crypto.randomUUID(),
        event: eventType,
        timestamp: new Date().toISOString(),
        data
    };

    // 3. Create delivery record + send for each subscription
    for (const sub of subscriptions) {
        const deliveryId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO webhook_deliveries (id, subscription_id, event_type, payload, status, company_id)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [deliveryId, sub.id, eventType, JSON.stringify(payload), companyId]
        );
        // Fire-and-forget — don't block the main request
        sendWebhook(deliveryId, sub.url, sub.secret, payload, 1).catch(err =>
            console.error(`[WEBHOOK] Delivery ${deliveryId} failed:`, err.message)
        );
    }
}

// --- HTTP send + retry logic ---
async function sendWebhook(
    deliveryId: string,
    url: string,
    secret: string | null,
    payload: WebhookPayload,
    attempt: number
): Promise<void> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-ETM-Event': payload.event,
        'X-ETM-Delivery': payload.id,
        'User-Agent': 'ETM-Webhook/1.0'
    };

    // HMAC signature if secret configured
    if (secret) {
        const signature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
        headers['X-ETM-Signature'] = `sha256=${signature}`;
    }

    // Update status to 'sending'
    await pool.query(
        `UPDATE webhook_deliveries SET status = 'sending', attempt = $1 WHERE id = $2`,
        [attempt, deliveryId]
    );

    try {
        // SSRF re-check at delivery time (TOCTOU / DNS rebinding defense).
        // The URL was validated at registration but DNS may have rotated to a
        // private/metadata IP since then.
        const safety = await validateWebhookUrlAsync(url);
        if (!safety.valid) {
            await pool.query(
                `UPDATE webhook_deliveries
                   SET status = 'failed', error_message = $1, updated_at = NOW()
                 WHERE id = $2`,
                [`SSRF check failed: ${safety.error}`, deliveryId]
            );
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

        let response: globalThis.Response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
                redirect: 'manual',
            });
        } finally {
            clearTimeout(timeout);
        }

        const responseBody = await response.text().catch(() => '');

        if (response.ok) {
            await pool.query(
                `UPDATE webhook_deliveries
                 SET status = 'delivered', response_status = $1, response_body = $2,
                     delivered_at = NOW()
                 WHERE id = $3`,
                [response.status, responseBody.substring(0, 1000), deliveryId]
            );
        } else {
            await handleRetry(deliveryId, attempt,
                `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
                response.status
            );
        }
    } catch (err: any) {
        await handleRetry(deliveryId, attempt,
            err.name === 'AbortError' ? 'Timeout (10s)' : err.message,
            null
        );
    }
}

// --- Retry logic (DB-persisted, no setTimeout) ---
async function handleRetry(
    deliveryId: string,
    attempt: number,
    errorMessage: string,
    responseStatus: number | null
): Promise<void> {
    const nextAttempt = attempt + 1;
    if (nextAttempt <= 4) {
        const delay = RETRY_DELAYS[attempt - 1] || 300_000;
        const nextRetry = new Date(Date.now() + delay);
        await pool.query(
            `UPDATE webhook_deliveries
             SET status = 'retrying', error_message = $1, response_status = $2,
                 next_retry_at = $3, attempt = $4
             WHERE id = $5`,
            [errorMessage, responseStatus, nextRetry.toISOString(), nextAttempt, deliveryId]
        );
        // No setTimeout — the retry processor will pick this up
    } else {
        // Max retries reached — mark as failed
        await pool.query(
            `UPDATE webhook_deliveries
             SET status = 'failed', error_message = $1, response_status = $2, attempt = $3
             WHERE id = $4`,
            [errorMessage, responseStatus, attempt, deliveryId]
        );
        console.warn(`[WEBHOOK] Delivery ${deliveryId} permanently failed after ${attempt} attempts`);
    }
}

// --- DB-based retry processor (call from app startup) ---
let retryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling for webhook retries every 30 seconds.
 * Picks up deliveries where status = 'retrying' AND next_retry_at <= NOW().
 * Survives server restarts because retry state is in the database.
 */
export function startWebhookRetryProcessor(): void {
    if (retryInterval) return; // already running

    const POLL_INTERVAL = 30_000; // 30 seconds

    // Add jitter (0-5s) to spread retries across replicas instead of hammering
    // all at once exactly on the 30s tick.
    const tick = async () => {
        // pool.connect() can throw (e.g. DB down) — keep it inside try so
        // the rejection doesn't escape the setInterval callback and crash
        // the process via unhandled promise rejection.
        let client: PoolClient | null = null;
        try {
            client = await pool.connect();

            // Watchdog (audit-3 C16): recover deliveries stuck in 'sending'.
            // The HTTP send has a 10s timeout (DELIVERY_TIMEOUT), so anything
            // still 'sending' after 5 minutes means the worker process died
            // mid-delivery (OOM, deploy, k8s eviction). Reset such rows to
            // 'retrying' so the next tick (or another replica) picks them up.
            // Without this, deliveries silently rot forever.
            const stuck = await client.query(
                `UPDATE webhook_deliveries
                    SET status = 'retrying',
                        next_retry_at = NOW(),
                        updated_at = NOW(),
                        error_message = COALESCE(error_message, '') || ' [recovered from sending-stuck state]'
                  WHERE status = 'sending' AND updated_at < NOW() - INTERVAL '5 minutes'`
            );
            if ((stuck.rowCount ?? 0) > 0) {
                console.log(`[WEBHOOK] watchdog recovered ${stuck.rowCount} stuck delivery row(s)`);
            }

            await client.query('BEGIN');
            // Atomically claim a batch of due retries: SKIP LOCKED prevents
            // two replicas from processing the same delivery.
            const { rows: dueRetries } = await client.query<{ id: string; payload: any; attempt: number; url: string; secret: string | null }>(`
                SELECT wd.id, wd.payload, wd.attempt,
                       ws.url, ws.secret
                FROM webhook_deliveries wd
                JOIN webhook_subscriptions ws ON ws.id = wd.subscription_id
                WHERE wd.status = 'retrying' AND wd.next_retry_at <= NOW()
                ORDER BY wd.next_retry_at ASC
                LIMIT 10
                FOR UPDATE OF wd SKIP LOCKED
            `);
            if (dueRetries.length > 0) {
                // Mark the claimed deliveries as in-flight (status='sending')
                // so a sibling replica's poll won't see them even before
                // the actual HTTP attempt finishes.
                await client.query(
                    `UPDATE webhook_deliveries
                       SET status = 'sending', updated_at = NOW()
                     WHERE id = ANY($1::uuid[])`,
                    [dueRetries.map((r) => r.id)],
                );
            }
            await client.query('COMMIT');

            for (const row of dueRetries) {
                const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
                const attemptNum = row.attempt || 1;
                sendWebhook(row.id, row.url, row.secret, payload, attemptNum).catch(err =>
                    console.error(`[WEBHOOK] Retry processor: delivery ${row.id} failed:`, err.message)
                );
            }
        } catch (err: any) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch { /* ignore */ }
            }
            console.error('[WEBHOOK] Retry processor error:', err?.message ?? err);
        } finally {
            if (client) client.release();
        }
    };

    retryInterval = setInterval(() => {
        const jitterMs = Math.floor(Math.random() * 5000);
        setTimeout(() => {
            // Belt-and-suspenders: even if `tick` somehow throws synchronously
            // before its own try/catch, a top-level `.catch` keeps the process alive.
            tick().catch((err) => console.error('[WEBHOOK] Retry tick error:', err?.message ?? err));
        }, jitterMs);
    }, POLL_INTERVAL);

    console.log('[WEBHOOK] Retry processor started (30s interval)');
}

/**
 * Stop the retry processor (for graceful shutdown).
 */
export function stopWebhookRetryProcessor(): void {
    if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
        console.log('[WEBHOOK] Retry processor stopped.');
    }
}

// --- Test webhook (admin UI "Test" button) ---
export async function testWebhook(subscriptionId: string): Promise<{
    success: boolean;
    status?: number;
    error?: string;
}> {
    const { rows } = await pool.query(
        `SELECT url, secret, event_type FROM webhook_subscriptions WHERE id = $1`,
        [subscriptionId]
    );
    if (rows.length === 0) return { success: false, error: 'Subscription not found' };

    const sub = rows[0];
    const testPayload: WebhookPayload = {
        id: crypto.randomUUID(),
        event: sub.event_type,
        timestamp: new Date().toISOString(),
        data: { test: true, message: 'This is a test webhook from ETM' }
    };

    const body = JSON.stringify(testPayload);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-ETM-Event': sub.event_type,
        'X-ETM-Delivery': testPayload.id,
        'User-Agent': 'ETM-Webhook/1.0'
    };

    if (sub.secret) {
        const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex');
        headers['X-ETM-Signature'] = `sha256=${signature}`;
    }

    try {
        const safety = await validateWebhookUrlAsync(sub.url);
        if (!safety.valid) {
            return { success: false, error: `SSRF check failed: ${safety.error}` };
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);
        const response = await fetch(sub.url, { method: 'POST', headers, body, signal: controller.signal, redirect: 'manual' });
        clearTimeout(timeout);
        return { success: response.ok, status: response.status };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
