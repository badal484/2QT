const { Client } = require('pg');
async function check() {
  const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true', ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT * FROM campaigns WHERE is_active = true');
    console.log(rows);
    client.end();
  } catch (e) { console.error(e); }
}
check();
