const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // Uses 6543
pool.query(`
    SELECT id, name, phone, email, role, is_active, created_at
    FROM users
    WHERE role IN ('finance', 'super_admin', 'admin', 'chef', 'kitchen_manager', 'rider', 'rider_captain')
    ORDER BY created_at DESC
`)
.then(res => { console.log("SUCCESS:", res.rows.length); process.exit(0); })
.catch(err => { console.error("ERROR:", err.message); process.exit(1); });
