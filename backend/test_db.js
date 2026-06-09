const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  try {
    const zones = await pool.query('SELECT * FROM zones');
    const zoneId = zones.rows[0].id;
    
    await pool.query(`
      INSERT INTO kitchens (zone_id, name, address, lat, lng)
      VALUES ($1, $2, $3, $4, $5)
    `, [zoneId, 'Central Kitchen', '123 Fake St', '12.9716', '77.6412']);
    console.log('Kitchen created!');
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}
check();
