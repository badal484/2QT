import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixMigrations() {
    const client = await pool.connect();
    try {
        const versions = ['001','002','003','004','005','006','007','008','009','010','011','012','013','014','015','016'];
        for (const v of versions) {
            await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [v]);
        }
        console.log('Fixed migration history.');
    } catch (err) {
        console.error('Failed to fix migrations:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixMigrations();
