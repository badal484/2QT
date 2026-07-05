const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const res = await pool.query(`
      SELECT COUNT(*)
      FROM restaurant_menu_items
      WHERE restaurant_id NOT IN (SELECT id FROM kitchens)
    `);
    console.log(`Found ${res.rows[0].count} orphaned restaurant_menu_items.`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
