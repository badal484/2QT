const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });

async function run() {
  try {
    const zonesRes = await pool.query(`
      DELETE FROM zones 
      WHERE id NOT IN (SELECT zone_id FROM kitchen_zones)
        AND id NOT IN (SELECT zone_id FROM orders WHERE zone_id IS NOT NULL)
        AND id NOT IN (SELECT zone_id FROM addresses WHERE zone_id IS NOT NULL)
      RETURNING id, name
    `);
    console.log(`Deleted ${zonesRes.rowCount} remaining empty zones.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
