require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const { rows } = await pool.query("SELECT id FROM users LIMIT 1");
    if (rows.length === 0) return console.log("No users");
    const userId = rows[0].id;
    
    const zoneRes = await pool.query("SELECT id FROM zones LIMIT 1");
    if (zoneRes.rows.length === 0) return console.log("No zones");
    const zoneId = zoneRes.rows[0].id;

    console.log("Inserting for user", userId, "zone", zoneId);

    const res = await pool.query(`
        INSERT INTO addresses (customer_id, label, address_text, lat, lng, zone_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [userId, 'Home', 'T4, Keredari', 12.34, 56.78, zoneId]);
    console.log(res.rows[0]);
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    pool.end();
  }
}
run();
