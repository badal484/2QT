const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function activate() {
  await pool.query("UPDATE zones SET is_active = true WHERE name LIKE '%Bachra%'");
  console.log("Bachra zone activated!");
}
activate().catch(console.error).finally(() => pool.end());
