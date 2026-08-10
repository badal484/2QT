const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT $1::text as test", [undefined]);
    console.log("Success:", res.rows);
  } catch (e) {
    console.log("Error:", e.message);
  }
  await client.end();
}
run();
