import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function seed() {
    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Create a Zone
        const zoneId = 'zone_bengaluru_central';
        await client.query(`
            INSERT INTO zones (id, name, city, center_lat, center_lng, radius_km)
            VALUES ($1, 'Bengaluru Central', 'Bengaluru', 12.9716, 77.5946, 10)
            ON CONFLICT (id) DO NOTHING
        `, [zoneId]);

        // 2. Create a Kitchen
        const kitchenId = 'kitchen_indiranagar';
        await client.query(`
            INSERT INTO kitchens (id, name, address, lat, lng, contact_number, status)
            VALUES ($1, 'Velto Indiranagar Kitchen', 'Indiranagar, Bengaluru', 12.9716, 77.5946, '9876543210', 'active')
            ON CONFLICT (id) DO NOTHING
        `, [kitchenId]);

        // 3. Link Kitchen to Zone
        await client.query(`
            INSERT INTO kitchen_zones (kitchen_id, zone_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [kitchenId, zoneId]);

        // 4. Create Categories
        const categories = ['Main Course', 'Sides', 'Beverages', 'Desserts'];
        for (const cat of categories) {
            await client.query(`
                INSERT INTO categories (name, description, image_url)
                VALUES ($1, $2, 'https://ik.imagekit.io/oellcbqek/default-category.png')
                ON CONFLICT (name) DO NOTHING
            `, [cat, `Delicious ${cat}`]);
        }

        // 5. Create Menu Items
        const { rows: categoryRows } = await client.query('SELECT id, name FROM categories');
        const catMap = Object.fromEntries(categoryRows.map(c => [c.name, c.id]));

        const menuItems = [
            {
                name: 'Ghee Roast Chicken Thali',
                description: 'Classic Kundapur style chicken ghee roast with 2 neer dosas',
                price: 24900,
                category_id: catMap['Main Course'],
                is_veg: false,
                photo_url: 'https://ik.imagekit.io/oellcbqek/ghee-roast.jpg'
            },
            {
                name: 'Paneer Butter Masala Meal',
                description: 'Creamy paneer butter masala with jeera rice and dal',
                price: 19900,
                category_id: catMap['Main Course'],
                is_veg: true,
                photo_url: 'https://ik.imagekit.io/oellcbqek/paneer.jpg'
            },
            {
                name: 'Cold Coffee',
                description: 'Classic brewed cold coffee with milk',
                price: 8900,
                category_id: catMap['Beverages'],
                is_veg: true,
                photo_url: 'https://ik.imagekit.io/oellcbqek/coffee.jpg'
            },
            {
                name: 'Gulab Jamun (2pcs)',
                description: 'Soft khoya balls in sugar syrup',
                price: 5900,
                category_id: catMap['Desserts'],
                is_veg: true,
                photo_url: 'https://ik.imagekit.io/oellcbqek/jamun.jpg'
            }
        ];

        for (const item of menuItems) {
            await client.query(`
                INSERT INTO menu_items (name, description, price_paise, category_id, kitchen_id, zone_id, is_veg, photo_url, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available')
                ON CONFLICT DO NOTHING
            `, [item.name, item.description, item.price, item.category_id, kitchenId, zoneId, item.is_veg, item.photo_url]);
        }

        // 6. Create some Riders
        const riders = [
            { name: 'Ravi Kumar', phone: '9000000001', vehicle: 'Activa' },
            { name: 'Suresh Raina', phone: '9000000002', vehicle: 'Pulsar' }
        ];

        for (const r of riders) {
            // First create user for rider
            const res = await client.query(`
                INSERT INTO users (email, phone, name, role, password_hash)
                VALUES ($1, $2, $3, 'rider', 'hashed_password')
                ON CONFLICT (phone) DO UPDATE SET role = 'rider'
                RETURNING id
            `, [`${r.name.toLowerCase().replace(' ', '.')}@velto.app`, r.phone, r.name]);

            const userId = res.rows[0].id;

            await client.query(`
                INSERT INTO riders (id, name, phone, vehicle_details, is_online, current_zone_id)
                VALUES ($1, $2, $3, $4, true, $5)
                ON CONFLICT (id) DO UPDATE SET is_online = true
            `, [userId, r.name, r.phone, r.vehicle, zoneId]);
        }

        console.log('Seeding completed successfully!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await client.end();
    }
}

seed();
