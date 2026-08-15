const { Pool } = require('pg');

const dbUrl = "postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@db.kkftttimpfenlgtjafnj.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to Supabase direct host...');
  
  const countRes = await pool.query(
    "SELECT count(*) FROM orders WHERE status NOT IN ('delivered', 'cancelled')"
  );
  console.log('Current live orders count before update:', countRes.rows[0].count);

  const updateRes = await pool.query(
    `UPDATE orders 
     SET status = 'delivered', 
         delivered_at = NOW(), 
         updated_at = NOW() 
     WHERE status NOT IN ('delivered', 'cancelled')
     RETURNING id, display_id`
  );

  console.log(`Successfully completed and marked ${updateRes.rowCount} orders as 'delivered'!`);

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
