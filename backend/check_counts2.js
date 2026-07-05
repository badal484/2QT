const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const res = await pool.query(`SELECT COUNT(*) FROM restaurant_menu_items`);
    console.log(`Total restaurant_menu_items: ${res.rows[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
