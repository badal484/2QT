const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;");
    const schema = {};
    for (const row of res.rows) {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push(`${row.column_name} (${row.data_type})`);
    }
    for (const [table, cols] of Object.entries(schema)) {
      if (['users', 'pre_launch_registrations', 'wallet', 'coupons'].includes(table)) {
        console.log(`\nTable: ${table}`);
        console.log(cols.join('\n'));
      }
    }
  } catch(e) { console.error(e); }
  await client.end();
}
run();
