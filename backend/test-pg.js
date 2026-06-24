const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  try {
    await pool.query('SELECT $1::text', [undefined]);
    console.log('SUCCESS');
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}
test().finally(() => pool.end());
