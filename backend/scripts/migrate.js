const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function migrate() {
  try {
    await pool.query('ALTER TABLE rider_applications ADD COLUMN IF NOT EXISTS id_photo_url text;');
    console.log("Migration successful");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
migrate();
