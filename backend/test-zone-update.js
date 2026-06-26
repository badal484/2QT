const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  try {
    const { rows } = await pool.query(`
        UPDATE zones SET
            name = COALESCE($1, name),
            radius_km = COALESCE($2, radius_km),
            delivery_fee_base_paise = COALESCE($3, delivery_fee_base_paise),
            surge_fee_paise = COALESCE($4, surge_fee_paise),
            opening_time = COALESCE($5, opening_time),
            closing_time = COALESCE($6, closing_time),
            max_orders_per_hour = COALESCE($7, max_orders_per_hour),
            is_active = COALESCE($8, is_active),
            realistic_delivery_minutes = COALESCE($9, realistic_delivery_minutes),
            surge_enabled = COALESCE($10, surge_enabled),
            polygon_points = COALESCE($11, polygon_points),
            kitchen_lat = COALESCE($13, kitchen_lat),
            kitchen_lng = COALESCE($14, kitchen_lng),
            updated_at = NOW()
        WHERE id = $12
        RETURNING *
    `, [
        "Bachra", 
        0, 
        2500, 
        null, // surge_fee_paise
        "10:00:00", 
        "22:00:00", 
        60, 
        false, // is_active
        15, 
        false, // surge_enabled
        "[]", 
        'b11db2e5-0238-40d9-bc0b-ebc2c0f18ca9',
        null, null
    ]);
    console.log("Success", rows[0].name);
  } catch (e) {
    console.error("Error", e.message);
  }
}
test().catch(console.error).finally(() => pool.end());
