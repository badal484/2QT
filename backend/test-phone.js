const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const { rows } = await pool.query("SELECT id, name, phone, role FROM users WHERE phone = '916204646300'");
  console.log(rows);
}
check().catch(console.error).finally(() => pool.end());
