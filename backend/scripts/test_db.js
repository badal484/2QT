const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL.replace('6543', '5432') });
pool.query("SELECT 1").then(() => console.log("Success")).catch(e => console.error("Error:", e.message)).finally(() => pool.end());
