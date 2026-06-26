const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
pool.query("SELECT * FROM orders WHERE display_id = '2QT-100006'")
  .then(res => console.log(res.rows[0]))
  .catch(console.error)
  .finally(() => pool.end());
