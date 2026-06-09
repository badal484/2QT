const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    await pool.query("UPDATE rider_applications SET id_photo_url = 'https://ik.imagekit.io/2qt/sample-id.jpg' WHERE id_photo_url IS NULL");
    console.log("Updated");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
