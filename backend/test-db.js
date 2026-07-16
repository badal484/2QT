const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const res = await client.query("ALTER TABLE pre_launch_registrations ADD COLUMN referral_code VARCHAR(255), ADD COLUMN referred_by VARCHAR(255);");
    console.log("Success:", res);
  } catch (e) {
    console.log("Error:", e.message);
  }
  await client.end();
}
run();
