const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT id, opening_time, closing_time FROM zones LIMIT 5').then(res => { console.log(res.rows); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
