const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  // Find restaurant zone
  const rc = await pool.query('SELECT zone_id FROM restaurant_config LIMIT 1');
  const zoneId = rc.rows[0]?.zone_id;
  if (!zoneId) { console.log('No restaurant found'); pool.end(); return; }

  console.log('Restaurant zone_id:', zoneId);

  // Count unavailable items
  const before = await pool.query(
    'SELECT COUNT(*) FROM menu_items WHERE zone_id = $1 AND available = false', [zoneId]
  );
  console.log('Items to fix:', before.rows[0].count);

  // Mark them available
  const result = await pool.query(
    'UPDATE menu_items SET available = true WHERE zone_id = $1 AND available = false RETURNING name', [zoneId]
  );
  console.log('Fixed:', result.rows.map(r => r.name));
  pool.end();
}

fix().catch(e => { console.error(e.message); pool.end(); });
