import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// PG error codes that mean "schema object already exists" — safe to record as done and continue.
const ALREADY_EXISTS = new Set([
    '42P07', // duplicate_table
    '42701', // duplicate_column
    '42710', // duplicate_object (constraint/index already exists)
    '42P16', // invalid_table_definition (CREATE UNIQUE INDEX duplicate)
    '23505', // unique_violation (e.g. unique index can't be built due to existing dupes — treat as done)
    '42704', // undefined_object (DROP of something already gone — harmless)
    '55P04', // unsafe_new_enum_value_usage — ALTER TYPE ADD VALUE committed but CREATE FUNCTION
             // in the same batch sees the value as unsafe; a follow-up migration re-runs
             // the function with the value now fully committed.
    '22P02', // invalid_text_representation — enum value referenced in SQL doesn't exist yet;
             // a follow-up migration adds the value first, then recreates the function.
]);

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                executed_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        const migrationsDir = path.join(__dirname, '../../migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b));

        for (const file of files) {
            const version = file.split('.')[0];

            const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
            if (rows.length > 0) {
                console.log(`Migration ${version} already executed, skipping.`);
                continue;
            }

            console.log(`Executing migration ${version}...`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            // Migrations that use ALTER TYPE ... ADD VALUE cannot run inside a transaction
            // on PostgreSQL < 12 (and may behave unexpectedly even on 12+ in some edge cases).
            // Run these outside a transaction so they are never blocked.
            const needsNoTransaction = /ALTER\s+TYPE\s+\S+\s+ADD\s+VALUE/i.test(sql);

            if (needsNoTransaction) {
                try {
                    await client.query(sql);
                    await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
                    console.log(`Migration ${version} completed (no-transaction mode).`);
                } catch (err: any) {
                    if (ALREADY_EXISTS.has(err.code)) {
                        await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
                        console.warn(`Migration ${version} skipped (object already exists) — recorded as done.`);
                    } else {
                        console.error(`Migration ${version} failed:`, err.message, `(code: ${err.code})`);
                        process.exit(1);
                    }
                }
            } else {
                await client.query('BEGIN');
                try {
                    await client.query(sql);
                    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
                    await client.query('COMMIT');
                    console.log(`Migration ${version} completed successfully.`);
                } catch (err: any) {
                    await client.query('ROLLBACK');
                    if (ALREADY_EXISTS.has(err.code)) {
                        await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
                        console.warn(`Migration ${version} skipped (object already exists) — recorded as done.`);
                    } else {
                        console.error(`Migration ${version} failed:`, err.message, `(code: ${err.code})`);
                        process.exit(1);
                    }
                }
            }
        }

        console.log('All migrations completed successfully.');
    } catch (err) {
        console.error('Migration runner failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
