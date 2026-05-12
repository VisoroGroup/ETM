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

        // In production, __dirname is dist/database/ but .sql files are in src/database/migrations/
        let migrationsDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            // Fallback: resolve from project root to src/database/migrations
            migrationsDir = path.join(__dirname, '..', '..', 'src', 'database', 'migrations');
        }

        if (!fs.existsSync(migrationsDir)) {
            console.warn('⚠️  Migrations directory not found. Skipping migrations.');
            return;
        }

        console.log(`📂 Migrations directory: ${migrationsDir}`);

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`📋 Found ${files.length} migration files.`);

        let failedCount = 0;

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

            // Strip SQL comment lines from the file, then split into individual statements
            // Uses a proper parser that respects quoted strings (semicolons inside '' are not delimiters)
            const cleanedSql = sql.split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n');

            const statements: string[] = [];
            let current = '';
            let inSingleQuote = false;
            let inDollarQuote = false;
            let dollarTag = '';
            for (let ci = 0; ci < cleanedSql.length; ci++) {
                const ch = cleanedSql[ci];

                // Handle $$ or $tag$ dollar-quoted strings (PL/pgSQL)
                if (ch === '$' && !inSingleQuote) {
                    // Look for dollar-quote tag: $$ or $tag$
                    const rest = cleanedSql.substring(ci);
                    const match = rest.match(/^(\$[a-zA-Z0-9_]*\$)/);
                    if (match) {
                        const tag = match[1];
                        if (inDollarQuote && tag === dollarTag) {
                            // Closing dollar quote
                            inDollarQuote = false;
                            current += tag;
                            ci += tag.length - 1;
                            continue;
                        } else if (!inDollarQuote) {
                            // Opening dollar quote
                            inDollarQuote = true;
                            dollarTag = tag;
                            current += tag;
                            ci += tag.length - 1;
                            continue;
                        }
                    }
                }

                if (inDollarQuote) {
                    current += ch;
                    continue;
                }

                if (ch === "'" && !inSingleQuote) {
                    inSingleQuote = true;
                    current += ch;
                } else if (ch === "'" && inSingleQuote) {
                    // Handle escaped quotes ''
                    if (ci + 1 < cleanedSql.length && cleanedSql[ci + 1] === "'") {
                        current += "''";
                        ci++;
                    } else {
                        inSingleQuote = false;
                        current += ch;
                    }
                } else if (ch === ';' && !inSingleQuote) {
                    const trimmed = current.trim();
                    if (trimmed.length > 0) statements.push(trimmed);
                    current = '';
                } else {
                    current += ch;
                }
            }
            const lastTrimmed = current.trim();
            if (lastTrimmed.length > 0) statements.push(lastTrimmed);

            console.log(`   📝 ${statements.length} statement(s) to execute`);

            // PostgreSQL forbids ALTER TYPE ... ADD VALUE inside a transaction
            // block. We auto-detect those statements and run them outside the
            // transaction so the rest of the file still gets atomic commit/rollback.
            const isOutsideTx = (s: string): boolean => /^\s*ALTER\s+TYPE\b[\s\S]*ADD\s+VALUE\b/i.test(s);
            const txStatements = statements.filter((s) => !isOutsideTx(s));
            const nonTxStatements = statements.filter((s) => isOutsideTx(s));

            try {
                // 1) Run ALTER TYPE ... ADD VALUE statements first (outside tx).
                for (let i = 0; i < nonTxStatements.length; i++) {
                    const stmt = nonTxStatements[i];
                    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
                    console.log(`   [pre/${i + 1}/${nonTxStatements.length}] ${preview}...`);
                    await client.query(stmt);
                }

                // 2) Run the rest atomically. Either ALL succeed or NONE.
                await client.query('BEGIN');
                try {
                    for (let i = 0; i < txStatements.length; i++) {
                        const stmt = txStatements[i];
                        const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
                        console.log(`   [${i + 1}/${txStatements.length}] ${preview}...`);
                        await client.query(stmt);
                    }
                    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
                    await client.query('COMMIT');
                    console.log(`✅ Completed: ${file}`);
                } catch (innerErr) {
                    await client.query('ROLLBACK');
                    throw innerErr;
                }
            } catch (err: any) {
                failedCount++;
                console.error(`❌ Failed: ${file}`, err?.message || err);
                // STOP on first failure: continuing leaves DB in inconsistent
                // state (later migrations may depend on this one).
                throw err;
            }
        }

        if (failedCount > 0) {
            console.warn(`⚠️  ${failedCount} migration(s) failed. Check logs above.`);
        } else {
            console.log('✅ Migrations up to date.');
        }
    } finally {
        client.release();
    }
}

// Allow standalone execution: npx tsx src/database/migrate.ts
if (require.main === module) {
    (async () => {
        const dotenv = await import('dotenv');
        dotenv.config({ path: path.join(__dirname, '../../..', '.env') });
        console.log('Starting migrations...');
        await runMigrations();
        await pool.end();
        console.log('Migrations complete, pool closed.');
    })().catch((err) => {
        console.error('Migration error:', err);
        process.exit(1);
    });
}

// CALLERS NOTE: when invoked from app.ts on boot, runMigrations now THROWS on
// the first failed migration (was: silently continued + process.exit(0)). Make
// sure callers either catch and decide whether to keep serving, or let the
// error propagate so the process restarts cleanly.
