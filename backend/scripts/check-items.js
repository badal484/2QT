const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const { rows: items } = await pool.query('SELECT id, name, zone_id, kitchen_id FROM menu_items');
  console.log(items);
}
check().catch(console.error).finally(() => pool.end());
