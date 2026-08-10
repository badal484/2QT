const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const resZones = await pool.query("SELECT id, name FROM zones WHERE name IN ('Kundanahalli', 'Kundanahalli Central', 'peto', 'uu')");
    console.log('Zones:', resZones.rows);
    
    const resKitchens = await pool.query("SELECT id, name FROM kitchens WHERE name IN ('2QT Central Kitchen', 'Peto', 'uu')");
    console.log('Kitchens:', resKitchens.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
