import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    const client = await pool.connect();
    try {
        // Create schema_migrations table
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
            
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
                await client.query('COMMIT');
                console.log(`Migration ${version} completed successfully.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`Migration ${version} failed:`, err);
                process.exit(1);
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
