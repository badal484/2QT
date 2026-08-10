const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true' });
  await client.connect();
  const res = await client.query(`
    SELECT m.id, m.name, m.zone_id as menu_zone_id, a.label, a.zone_id as address_zone_id, z.name as address_zone_name
    FROM menu_items m, addresses a
    LEFT JOIN zones z ON a.zone_id = z.id
    ORDER BY a.created_at DESC
    LIMIT 5;
  `);
  console.log(res.rows);
  process.exit();
}
run();
