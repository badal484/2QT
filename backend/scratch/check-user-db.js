// check-user-db.js
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found in .env. Loaded keys:', Object.keys(process.env));
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const phone = '916204646300';
    console.log(`Searching for user with phone: ${phone}`);
    const res = await client.query('SELECT id, name, phone, email, photo_url, role FROM users WHERE phone = $1', [phone]);
    console.log('User Record in DB:', res.rows[0]);
  } catch (err) {
    console.error('Error running query:', err.message);
  } finally {
    await client.end();
  }
}

run();
