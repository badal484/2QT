const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE zones 
            ADD COLUMN IF NOT EXISTS polygon_points JSONB DEFAULT NULL;
        `);
        console.log("Migration successful: Added polygon_points to zones.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
