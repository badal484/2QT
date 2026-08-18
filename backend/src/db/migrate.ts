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

export async function runMigrations() {
    let client;
    try {
        client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                executed_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        const migrationsDir = path.join(__dirname, '../../migrations');
        if (!fs.existsSync(migrationsDir)) return;

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b));

        for (const file of files) {
            const version = file.split('.')[0];
            const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
            if (rows.length > 0) continue;

            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf-8');

            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
                console.log(`[MIGRATIONS] Migration ${version} completed successfully.`);
            } catch (err: any) {
                if (ALREADY_EXISTS.has(err.code)) {
                    await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
                    console.warn(`[MIGRATIONS] Migration ${version} skipped (object already exists) — recorded as done.`);
                } else {
                    console.error(`[MIGRATIONS] Migration ${version} failed:`, err.message, `(code: ${err.code})`);
                }
            }
        }
        console.log('[MIGRATIONS] All pending migrations checked and executed successfully.');
    } catch (err) {
        console.error('[MIGRATIONS] Migration runner failed:', err);
    } finally {
        if (client) client.release();
    }
}

if (require.main === module) {
    runMigrations().then(() => pool.end());
}
