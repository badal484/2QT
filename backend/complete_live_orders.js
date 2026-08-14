const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true";

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to database...');
  
  const countRes = await pool.query(
    "SELECT count(*) FROM orders WHERE status NOT IN ('delivered', 'cancelled')"
  );
  console.log('Current live orders count:', countRes.rows[0].count);

  const updateRes = await pool.query(
    `UPDATE orders 
     SET status = 'delivered', 
         delivered_at = NOW(), 
         updated_at = NOW() 
     WHERE status NOT IN ('delivered', 'cancelled')
     RETURNING id, display_id, status`
  );

  console.log(`Successfully updated ${updateRes.rowCount} orders to 'delivered'!`);
  if (updateRes.rowCount > 0) {
    console.log('Sample updated orders:', updateRes.rows.slice(0, 10).map(r => r.display_id || r.id));
  }

  const finalCount = await pool.query(
    "SELECT count(*) FROM orders WHERE status NOT IN ('delivered', 'cancelled')"
  );
  console.log('Remaining live orders count:', finalCount.rows[0].count);

  await pool.end();
}

main().catch(err => {
  console.error('Error executing query:', err);
  process.exit(1);
});
