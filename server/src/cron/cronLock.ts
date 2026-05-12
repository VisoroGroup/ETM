import pool from '../config/database';

/**
 * Wrap a cron job in a Postgres session-level advisory lock so that on a
 * multi-replica deploy only ONE replica actually runs the job. The lock is
 * released either when the job finishes (we explicitly call pg_advisory_unlock)
 * or when the connection dies (Postgres releases session locks on disconnect).
 *
 * `lockKey` must be a stable 32-bit integer that's unique per logical job.
 * Use small integers (1, 2, 3...) — the namespace is private to this app.
 */
export async function withCronLock(
    lockKey: number,
    jobName: string,
    fn: () => Promise<void>,
): Promise<void> {
    const client = await pool.connect();
    try {
        const { rows } = await client.query<{ pg_try_advisory_lock: boolean }>(
            'SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock',
            [lockKey],
        );
        if (!rows[0]?.pg_try_advisory_lock) {
            console.log(`⏭️  [${jobName}] another replica holds the lock — skipping this tick`);
            return;
        }
        try {
            await fn();
        } finally {
            try {
                await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
            } catch (err) {
                console.error(`[${jobName}] failed to release advisory lock:`, err);
            }
        }
    } finally {
        client.release();
    }
}
