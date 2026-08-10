require('dotenv').config({ path: 'backend/.env' });
const { query } = require('./backend/dist/db');
async function run() {
  try {
    const { rows: addresses } = await query('SELECT * FROM addresses LIMIT 5');
    console.log('Addresses:', addresses.map(a => a.zone_id));
    const { rows: items } = await query('SELECT id, zone_id FROM menu_items LIMIT 5');
    console.log('Items:', items.map(i => i.zone_id));
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
