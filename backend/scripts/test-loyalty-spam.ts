import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/velto',
});

async function run() {
  // 1. Create a fake user and order
  const userRes = await pool.query(`INSERT INTO users (phone, name, role) VALUES ('9999999999', 'Test User', 'customer') RETURNING id`);
  const userId = userRes.rows[0].id;

  const orderRes = await pool.query(`INSERT INTO orders (customer_id, status, total_amount_paise) VALUES ($1, 'delivered', 10000) RETURNING id`, [userId]);
  const orderId = orderRes.rows[0].id;

  const token = jwt.sign({ userId, role: 'customer' }, process.env.JWT_SECRET || 'secret');

  // 2. Spam feedback 10 times concurrently
  const requests = Array.from({ length: 10 }).map(() => 
    fetch(`http://localhost:3000/api/customer/orders/${orderId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ foodRating: 5, deliveryRating: 5 })
    })
  );

  await Promise.all(requests);

  // 3. Check loyalty points
  const pointsRes = await pool.query(`SELECT COUNT(*) as count, SUM(points) as total FROM loyalty_transactions WHERE customer_id = $1`, [userId]);
  console.log('Loyalty Transactions count:', pointsRes.rows[0].count);
  console.log('Total points earned:', pointsRes.rows[0].total);

  // 4. Cleanup
  await pool.query(`DELETE FROM order_feedback WHERE customer_id = $1`, [userId]);
  await pool.query(`DELETE FROM loyalty_transactions WHERE customer_id = $1`, [userId]);
  await pool.query(`DELETE FROM orders WHERE customer_id = $1`, [userId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  process.exit(0);
}

run().catch(console.error);
