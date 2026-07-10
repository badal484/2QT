const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true' });
pool.query('SELECT * FROM app_settings').then(res => { console.log(res.rows); pool.end(); });
