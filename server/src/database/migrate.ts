import pool from '../config/database';
import fs from 'fs';
import path from 'path';

export async function runMigrations() {
    const client = await pool.connect();

    try {
        // Create migrations tracking table
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const { rows } = await client.query(
                'SELECT id FROM _migrations WHERE name = $1',
                [file]
            );

            if (rows.length > 0) {
                continue; // already executed
            }

            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
            console.log(`🔄 Running migration: ${file}`);

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`✅ Completed: ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed: ${file}`, err);
                throw err;
            }
        }

        console.log('✅ Migrations up to date.');
    } finally {
        client.release();
    }
}

// Allow standalone execution: npx tsx src/database/migrate.ts
if (require.main === module) {
    import('dotenv').then(dotenv => {
        dotenv.config({ path: path.join(__dirname, '../../..', '.env') });
    });
    runMigrations()
        .then(() => pool.end())
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

