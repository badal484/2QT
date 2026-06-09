const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  try {
    const res = await pool.query(`
      INSERT INTO users (name, phone, role, is_verified) 
      VALUES ('Test Rider', '9999999999', 'rider', true)
      ON CONFLICT (phone) DO UPDATE SET role = 'rider', is_verified = true
      RETURNING *;
    `);
    console.log('✅ Created Test Rider:', res.rows[0].phone);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
seed();
