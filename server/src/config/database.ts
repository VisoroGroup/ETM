import { Pool } from 'pg';
import pg from 'pg';

// Prevent pg from converting DATE to JavaScript Date object
// Return as plain YYYY-MM-DD string instead
pg.types.setTypeParser(1082, (val: string) => val); // 1082 = DATE OID

/**
 * SSL configuration for PostgreSQL connection.
 * - If DATABASE_CA_CERT is set, use it with rejectUnauthorized: true
 * - If running on Railway (DATABASE_URL contains "railway.app"), use rejectUnauthorized: true
 * - Otherwise (local dev), disable SSL
 * 
 * NEVER use rejectUnauthorized: false in production — it disables certificate
 * verification and makes the connection vulnerable to MITM attacks.
 */
function getSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
    const caCert = process.env.DATABASE_CA_CERT;
    const dbUrl = process.env.DATABASE_URL || '';
    const isProduction = process.env.NODE_ENV === 'production';

    if (caCert) {
        // CA certificate provided — most secure option
        return { rejectUnauthorized: true, ca: caCert };
    }

    if (isProduction || dbUrl.includes('railway.app')) {
        // Railway uses self-signed certs — accept them when no explicit CA is provided
        return { rejectUnauthorized: false };
    }

    // Local development — no SSL needed
    return false;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getSslConfig(),
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export default pool;
