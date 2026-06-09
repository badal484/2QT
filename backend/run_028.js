const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations/028_promotional_banners.sql'), 'utf8');
        await client.query(sql);
        console.log("Migration 028 executed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
