const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  try {
    const custRes = await pool.query(`
      INSERT INTO users (name, phone, role) 
      VALUES ('John Customer', '918888888888', 'customer')
      ON CONFLICT (phone) DO UPDATE SET name = 'John Customer'
      RETURNING id;
    `);
    const custId = custRes.rows[0].id;

    const addrRes = await pool.query(`
      INSERT INTO addresses (customer_id, address_text, lat, lng, type)
      VALUES ($1, '100ft Road, Indiranagar', 12.9783, 77.6408, 'home')
      RETURNING id;
    `, [custId]);
    const addrId = addrRes.rows[0].id;

    let kitchenId, zoneId;
    const kitRes = await pool.query(`SELECT id, zone_id FROM kitchens LIMIT 1`);
    if (kitRes.rows.length > 0) {
      kitchenId = kitRes.rows[0].id;
      zoneId = kitRes.rows[0].zone_id;
    }

    const orderRes = await pool.query(`
      INSERT INTO orders (id, display_id, customer_id, address_id, kitchen_id, zone_id, status, payment_method, total_amount_paise, delivery_otp)
      VALUES ($1, 'VLT-TEST', $2, $3, $4, $5, 'ready_for_pickup', 'cod', 45000, '654321')
      RETURNING *;
    `, [uuidv4(), custId, addrId, kitchenId, zoneId]);
    
    const orderId = orderRes.rows[0].id;

    await pool.query(`
      INSERT INTO order_items (id, order_id, menu_item_name, quantity, price_paise)
      VALUES ($1, $2, 'Margherita Pizza', 1, 45000)
    `, [uuidv4(), orderId]);

    console.log('🍔 Mock Order created! Go online in the Rider app to see it.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
seed();
