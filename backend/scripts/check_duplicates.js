const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const res = await pool.query(`
      SELECT name, COUNT(*)
      FROM menu_items
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    console.log(`Found ${res.rows.length} duplicate groups in menu_items.`);
    if (res.rows.length > 0) {
      console.log('Sample:', res.rows.slice(0, 5));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
