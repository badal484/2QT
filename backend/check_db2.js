require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    const { rows: addresses } = await pool.query('SELECT id, label, address_text, zone_id FROM addresses ORDER BY created_at DESC LIMIT 5');
    console.log('Addresses:', addresses);
    
    // get cart items for the latest user
    if(addresses.length > 0) {
      const { rows: items } = await pool.query('SELECT id, name, zone_id FROM menu_items LIMIT 5');
      console.log('Menu Items:', items);
    }
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
