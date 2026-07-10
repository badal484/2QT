const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true' });

async function run() {
  try {
    const res = await pool.query("SELECT * FROM app_settings WHERE key = 'feature_loyalty'");
    if (res.rows.length === 0) {
      await pool.query(
        "INSERT INTO app_settings (key, value, description) VALUES ($1, $2, $3)",
        ['feature_loyalty', 'true', 'Enable loyalty points program']
      );
      console.log('Inserted feature_loyalty');
    } else {
      console.log('feature_loyalty already exists');
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
