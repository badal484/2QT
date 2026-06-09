const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO promotional_banners (title, subtitle, tag_text, image_url, action_type, action_payload, display_order, is_active)
            VALUES 
            ('Gourmet Meals Crafted for you', 'Premium dishes prepared fresh by top-tier chefs.', '30 MIN', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2000&auto=format&fit=crop', 'NONE', '', 1, true),
            ('50% Off First Order', 'Use code FIRST50 at checkout', 'NEW USER', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2000&auto=format&fit=crop', 'APPLY_COUPON', 'FIRST50', 2, true),
            ('Healthy Bowls', 'Try our Mediterranean Quinoa Bowls today', 'TRENDING', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=2000&auto=format&fit=crop', 'FILTER_CATEGORY', 'Healthy', 3, true);
        `);
        console.log("Seeded promotional banners successfully.");
    } catch (err) {
        console.error("Seed failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
