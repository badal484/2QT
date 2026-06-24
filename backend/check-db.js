const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const { rows: zones } = await pool.query('SELECT * FROM zones');
  console.log("Zones:", zones.length);
  for (let z of zones) {
    const { rows: items } = await pool.query('SELECT count(*) FROM menu_items WHERE zone_id = $1', [z.id]);
    console.log(`Zone ${z.name} (${z.id}): ${items[0].count} items`);
  }
}
check().catch(console.error).finally(() => pool.end());
