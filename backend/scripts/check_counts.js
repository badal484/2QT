const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM restaurant_menu_items`);
    const distinct = await pool.query(`SELECT COUNT(DISTINCT name) FROM restaurant_menu_items`);
    console.log(`Total items: ${total.rows[0].count}`);
    console.log(`Distinct names: ${distinct.rows[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
