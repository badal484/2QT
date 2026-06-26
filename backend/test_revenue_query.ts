import { query } from './src/db';
async function run() {
  try {
    console.log("Running query...");
    const res = await query(`
      SELECT
        mi.id, mi.name, mi.image_url,
        k.name AS kitchen_name,
        COUNT(oi.id) AS units_sold,
        COALESCE(SUM(oi.quantity), 0) AS total_quantity,
        COALESCE(SUM(oi.price_paise * oi.quantity), 0) AS total_revenue_paise,
        AVG(oi.price_paise) AS avg_price_paise
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN kitchens k ON mi.kitchen_id = k.id
      WHERE o.status = 'delivered'
      GROUP BY mi.id, mi.name, mi.image_url, k.name
      ORDER BY total_revenue_paise DESC
      LIMIT 5
    `);
    console.log("Success:", res.rows);
  } catch (e) {
    console.error("SQL Error:", e);
  }
  process.exit();
}
run();
