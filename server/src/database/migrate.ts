import pool from '../config/database';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

async function migrate() {
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
                console.log(`⏭️  Skipping ${file} (already executed)`);
                continue;
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

        console.log('\n✅ All migrations completed successfully!');
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
