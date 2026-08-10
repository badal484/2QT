const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function update() {
  const { rows } = await pool.query("SELECT id, customization_groups FROM menu_items WHERE name ILIKE '%Veg Rice%'");
  for (const row of rows) {
    const groups = row.customization_groups;
    if (groups) {
      for (const g of groups) {
        for (const o of g.options) {
          if (o.name === 'Amul Cheese') {
            o.photo_url = 'https://ik.imagekit.io/yryxhmqps/menu_items/amul.png';
          }
        }
      }
      await pool.query("UPDATE menu_items SET customization_groups = $1 WHERE id = $2", [JSON.stringify(groups), row.id]);
      console.log('UPDATED', row.id);
    }
  }
  process.exit();
}
update();
