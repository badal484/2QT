const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const demoItems = [
      '2QT Special Cold Brew',
      'Belgian Chocolate Lava Cake',
      'Paneer Tikka Platter',
      'Truffle Mushroom Risotto',
      'Kashmiri Mutton Rogan Josh',
      'Avocado Quinoa Salad'
    ];

    const res = await pool.query(`
      DELETE FROM menu_items
      WHERE name = ANY($1)
      RETURNING id, name
    `, [demoItems]);

    console.log(`Deleted ${res.rowCount} demo menu items:`);
    console.log(res.rows.map(r => r.name));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
