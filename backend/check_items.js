require('dotenv').config({ path: '.env' });
const { query } = require('./dist/db');
async function run() {
  const { rows: zones } = await query("SELECT id, name FROM zones WHERE name ILIKE '%polaris%'");
  console.log('Polaris Zone:', zones);
  if (zones.length > 0) {
    const { rows: items } = await query("SELECT count(*) FROM menu_items WHERE zone_id = $1", [zones[0].id]);
    console.log('Items in Polaris Zone:', items[0].count);
  }
  process.exit();
}
run();
