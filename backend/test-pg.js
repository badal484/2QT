const { Pool } = require('pg');
process.env.PGUSER = "postgres";
const pool = new Pool({
  connectionString: "postgresql://postgres.kkftttimpfenlgtjafnj:Badal%404834@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
});
console.log(pool.options.user);
