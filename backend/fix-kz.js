const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function fix() {
  await pool.query("INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ('d5b6df53-4246-4ee4-acc0-337a02e60a03', '6a6b13f4-8d51-4c4c-a669-18c7139de4ee') ON CONFLICT DO NOTHING");
  console.log("Fixed Kundanahalli kitchen mapping");
}
fix().catch(console.error).finally(() => pool.end());
