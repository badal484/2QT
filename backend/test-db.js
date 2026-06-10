const { Pool } = require('pg');

async function test(ssl) {
  try {
    const pool = new Pool({
      connectionString: "postgresql://postgres.kkftttimpfenlgtjafnj:Badal%404834@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
      ssl: ssl
    });
    await pool.query('SELECT 1');
    console.log('Success with ssl:', !!ssl);
    await pool.end();
  } catch (err) {
    console.log('Failed with ssl:', !!ssl, err.message);
  }
}

async function run() {
  await test(false);
  await test({ rejectUnauthorized: false });
}
run();
