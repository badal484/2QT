const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Cleaning up duplicate menu items...');
        await client.query(`
            DELETE FROM menu_items a USING menu_items b
            WHERE a.id < b.id AND a.name = b.name;
        `);
        console.log('Adding unique constraint...');
        await client.query(`
            ALTER TABLE menu_items ADD CONSTRAINT menu_items_name_unique UNIQUE (name);
        `);
        console.log('Done.');
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
