const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  try {
    const res = await pool.query("SELECT id FROM zones LIMIT 1");
    if (!res.rows[0]) return console.log("No zones");
    const zone_id = res.rows[0].id;
    const kRes = await pool.query("SELECT kitchen_id FROM kitchen_zones WHERE zone_id=$1", [zone_id]);
    const kitchen_id = kRes.rows[0].kitchen_id;

    const { rows } = await pool.query(
        'INSERT INTO menu_items (zone_id, kitchen_id, name, description, price_paise, cost_price_paise, category, station, photo_url, available, is_veg, is_egg, is_bestseller, is_new, tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
        [zone_id, kitchen_id, 'Veg Paneer Roll', 'A wholesome roll', 5500, 3850, 'Roll', 'Main Kitchen', 'https://ik.imagekit.io/badal/test.jpg', true, true, true, false, false, ['Serves 1']]
    );
    console.log("Success", rows[0]);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    pool.end();
  }
}
test();
