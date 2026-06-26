const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const { rows: zones } = await pool.query('SELECT id, name FROM zones');
  const { rows: items } = await pool.query('SELECT id, name, zone_id, kitchen_id FROM menu_items');

  const kundanahalliZone = zones.find(z => z.name === 'Kundanahalli');
  const sourceZoneId = items.length > 0 ? items[0].zone_id : null;
  
  if (kundanahalliZone && sourceZoneId && kundanahalliZone.id !== sourceZoneId) {
    for (const item of items) {
      if (item.zone_id === sourceZoneId) {
        await pool.query(`
          INSERT INTO menu_items (zone_id, kitchen_id, name, description, price_paise, cost_price_paise, category, station, available, daily_limit, is_veg, photo_url)
          SELECT $1, kitchen_id, name, description, price_paise, cost_price_paise, category, station, available, daily_limit, is_veg, photo_url
          FROM menu_items WHERE id = $2
          ON CONFLICT DO NOTHING
        `, [kundanahalliZone.id, item.id]);
      }
    }
    console.log("Items copied to Kundanahalli successfully!");
  } else {
    console.log("Nothing to copy or already copied.");
  }
  process.exit(0);
}
run();
