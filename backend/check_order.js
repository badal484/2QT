require('dotenv').config({ path: 'backend/.env' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
  try {
    await client.connect();
    const { rows: order } = await client.query("SELECT * FROM orders WHERE display_id = '2QT-100095'");
    if (order.length > 0) {
      console.log('Order:', order[0]);
      const { rows: kitchen } = await client.query("SELECT id, name, lat, lng, is_active FROM kitchens WHERE id = $1", [order[0].kitchen_id]);
      console.log('Kitchen assigned:', kitchen[0]);
    } else {
      console.log('Order not found');
    }
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
