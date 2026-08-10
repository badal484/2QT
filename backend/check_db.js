require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    const { rows: addresses } = await pool.query('SELECT id, label, address_text, zone_id, lat, lng, customer_id FROM addresses ORDER BY created_at DESC LIMIT 5');
    console.log('Addresses:', addresses);
    
    // get cart items for the latest user
    if(addresses.length > 0) {
      const { rows: cart } = await pool.query('SELECT items FROM carts WHERE customer_id = $1', [addresses[0].customer_id]);
      console.log('Cart Items:', JSON.stringify(cart, null, 2));
      
      if(cart.length > 0 && cart[0].items.length > 0) {
        const itemIds = cart[0].items.map(i => i.menuItemId);
        const { rows: items } = await pool.query('SELECT id, name, zone_id FROM menu_items WHERE id = ANY($1)', [itemIds]);
        console.log('Menu Items in Cart:', items);
      }
    }
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
