const { Pool } = require('pg');
require('dotenv').config({path: 'backend/.env'});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const { rows } = await pool.query("SELECT name, customization_groups FROM menu_items WHERE name ILIKE '%Veg Rice%'");
  console.log(JSON.stringify(rows, null, 2));
  process.exit();
}
check();
