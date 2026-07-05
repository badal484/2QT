const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const categoriesRes = await pool.query('SELECT COUNT(*) FROM menu_categories');
    const itemsRes = await pool.query('SELECT COUNT(*) FROM menu_items');
    const restItemsRes = await pool.query('SELECT COUNT(*) FROM restaurant_menu_items');
    
    console.log(`menu_categories count: ${categoriesRes.rows[0].count}`);
    console.log(`menu_items count: ${itemsRes.rows[0].count}`);
    console.log(`restaurant_menu_items count: ${restItemsRes.rows[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
