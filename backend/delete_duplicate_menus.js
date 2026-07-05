const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const res = await pool.query(`
      DELETE FROM menu_items
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rnum
          FROM menu_items
        ) t
        WHERE t.rnum > 1
      )
      RETURNING id, name
    `);
    console.log(`Deleted ${res.rowCount} duplicate menu items:`);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
