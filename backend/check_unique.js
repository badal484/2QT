const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'pre_launch_registrations'::regclass
    `);
    console.log(res.rows);
  } catch(e) { console.error(e); }
  await client.end();
}
run();
