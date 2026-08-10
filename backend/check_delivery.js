require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const { rows } = await pool.query("SELECT name, delivery_fee_type, base_delivery_fee_paise, per_km_fee_paise, base_distance_km FROM zones WHERE name ILIKE '%polaris%'");
  console.log(rows);
  process.exit();
}
run();
