const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
async function run() {
  await client.connect();
  try {
    await client.query("ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;");
    console.log("Column user_id added successfully.");
  } catch(e) { console.error(e); }
  await client.end();
}
run();
