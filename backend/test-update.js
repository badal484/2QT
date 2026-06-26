const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function fix() {
  const computedKitchenLat = 23.6370;
  const computedKitchenLng = 85.3374;
  const id = 'b11db2e5-0238-40d9-bc0b-ebc2c0f18ca9';

  try {
    await pool.query(`
        UPDATE kitchens k SET lat = $1, lng = $2, updated_at = NOW()
        FROM kitchen_zones kz WHERE kz.kitchen_id = k.id AND kz.zone_id = $3
    `, [computedKitchenLat, computedKitchenLng, id]);
    console.log("Success kitchen update");
  } catch (err) {
    console.error("Error kitchen update", err);
  }
}
fix().catch(console.error).finally(() => pool.end());
