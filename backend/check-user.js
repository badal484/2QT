const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', ['d3f39773-83a0-4d37-b0e0-71ee6f560b16']);
  console.log(rows);
}
check().catch(console.error).finally(() => pool.end());
