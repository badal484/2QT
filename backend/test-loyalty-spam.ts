import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true',
});

async function run() {
  const userRes = await pool.query(`INSERT INTO users (phone, name, role) VALUES ('8888888888', 'Test User', 'customer') RETURNING id`);
  const userId = userRes.rows[0].id;

  const orderRes = await pool.query(`INSERT INTO orders (customer_id, status, total_amount_paise) VALUES ($1, 'delivered', 10000) RETURNING id`, [userId]);
  const orderId = orderRes.rows[0].id;

  const token = jwt.sign({ userId, role: 'customer' }, 'pCWIlnt+NJooyCaQkeq5RMeth8kXEDYXHjg76oO8uQrDT5qvGh9yIXJdQigaA3NN');

  const requests = Array.from({ length: 10 }).map(() => 
    fetch(`http://localhost:8000/api/customer/orders/${orderId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ foodRating: 5, deliveryRating: 5 })
    })
  );

  await Promise.all(requests);

  const pointsRes = await pool.query(`SELECT COUNT(*) as count, SUM(points) as total FROM loyalty_transactions WHERE customer_id = $1`, [userId]);
  console.log('Loyalty Transactions count:', pointsRes.rows[0].count);
  console.log('Total points earned:', pointsRes.rows[0].total);

  await pool.query(`DELETE FROM order_feedback WHERE customer_id = $1`, [userId]);
  await pool.query(`DELETE FROM loyalty_transactions WHERE customer_id = $1`, [userId]);
  await pool.query(`DELETE FROM orders WHERE customer_id = $1`, [userId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  process.exit(0);
}

run().catch(console.error);
