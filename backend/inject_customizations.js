const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true'
});

const customizations = [
  {
    name: "Spice Level",
    required: true,
    options: [
      { name: "Mild", price_paise: 0 },
      { name: "Medium", price_paise: 0 },
      { name: "Extra Spicy", price_paise: 0 }
    ]
  },
  {
    name: "Add-ons",
    required: false,
    options: [
      { name: "Extra Cheese", price_paise: 4000 },
      { name: "Extra Sauce", price_paise: 2000 }
    ]
  }
];

async function run() {
  try {
    const res = await pool.query(
      `UPDATE menu_items SET customization_groups = $1 
       WHERE name IN ('Paneer Tikka Platter', 'Kashmiri Mutton Rogan Josh', 'Veg Biryani') 
       RETURNING name`,
      [JSON.stringify(customizations)]
    );
    console.log("Updated items:", res.rows.map(r => r.name));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
