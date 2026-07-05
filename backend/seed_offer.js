require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    try {
        await pool.query(`INSERT INTO menu_offers (name, discount_type, discount_percent, max_discount_paise, target_type) VALUES ('20% OFF World Class Offer', 'percentage', 20, 5000, 'all');`);
        console.log('Seeded successfully');
    } catch(err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
seed();
