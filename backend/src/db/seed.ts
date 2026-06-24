import { query, withTransaction } from './index';
import bcrypt from 'bcrypt';

const seed = async () => {
  console.log('[SEED] Starting database seed...');

  try {
    await withTransaction(async (client) => {
      // 1. Create Zone
      const { rows: zones } = await client.query(`
        INSERT INTO zones (name, is_active, radius_km, kitchen_lat, kitchen_lng, opening_time, closing_time)
        VALUES ('Kundanahalli Central', true, 5.0, 12.9716, 77.5946, '10:30', '22:00')
        ON CONFLICT DO NOTHING
        RETURNING id
      `);
      
      let zoneId;
      if (zones.length > 0 && zones[0].id) {
        zoneId = zones[0].id;
      } else {
        const existingZone = await client.query("SELECT id FROM zones WHERE name = 'Kundanahalli Central' LIMIT 1");
        if (existingZone.rows.length > 0) {
          zoneId = existingZone.rows[0].id;
        } else {
          const anyZone = await client.query("SELECT id FROM zones LIMIT 1");
          zoneId = anyZone.rows[0]?.id;
        }
      }
      if (!zoneId) throw new Error("Could not evaluate zoneId");

      // 2. Create Kitchen
      const { rows: kitchens } = await client.query(`
        INSERT INTO kitchens (name, address, lat, lng)
        VALUES ('2QT Central Kitchen', 'Kundanahalli Main Road, Near ITPL', 12.9716, 77.5946)
        ON CONFLICT DO NOTHING
        RETURNING id
      `);

      let kitchenId;
      if (kitchens.length > 0 && kitchens[0].id) {
        kitchenId = kitchens[0].id;
      } else {
        const existingKitchen = await client.query("SELECT id FROM kitchens WHERE name = '2QT Central Kitchen' LIMIT 1");
        if (existingKitchen.rows.length > 0) {
          kitchenId = existingKitchen.rows[0].id;
        } else {
          const anyKitchen = await client.query("SELECT id FROM kitchens LIMIT 1");
          kitchenId = anyKitchen.rows[0]?.id;
        }
      }
      if (!kitchenId) throw new Error("Could not evaluate kitchenId");

      // Link Kitchen to Zone
      await client.query('INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [kitchenId, zoneId]);

      // 3. Create Ingredients
      await client.query(`
        INSERT INTO ingredients (kitchen_id, name, unit, current_stock_grams, reorder_threshold_grams)
        VALUES 
          ($1, 'Basmati Rice', 'kg', 100, 20),
          ($1, 'Chicken', 'kg', 50, 10),
          ($1, 'Onions', 'kg', 30, 5),
          ($1, 'Paneer', 'kg', 20, 5)
        ON CONFLICT DO NOTHING
      `, [kitchenId]);

      // 4. Create Menu Items
      const menuItems = [
        { name: 'Truffle Mushroom Risotto', price: 45000, cat: 'Signature', veg: true, station: 'Main' },
        { name: 'Kashmiri Mutton Rogan Josh', price: 55000, cat: 'Curries', veg: false, station: 'Main' },
        { name: 'Avocado Quinoa Salad', price: 35000, cat: 'Healthy', veg: true, station: 'Salad' },
        { name: 'Belgian Chocolate Lava Cake', price: 25000, cat: 'Desserts', veg: true, station: 'Dessert' },
        { name: 'Paneer Tikka Platter', price: 32000, cat: 'Appetizers', veg: true, station: 'Tandoor' },
        { name: '2QT Special Cold Brew', price: 18000, cat: 'Beverages', veg: true, station: 'Beverage' }
      ];

      for (const item of menuItems) {
        await client.query(`
          INSERT INTO menu_items (zone_id, kitchen_id, name, description, price_paise, cost_price_paise, category, station, available, daily_limit, is_veg)
          VALUES ($1, $2, $3, 'Premium selection from 2QT Palace.', $4, $5, $6, $7, true, 50, $8)
          ON CONFLICT (zone_id, name) DO UPDATE SET price_paise = $4
        `, [zoneId, kitchenId, item.name, item.price, Math.round(item.price * 0.35), item.cat, item.station, item.veg]);
      }

      // 5. Create Promo Code
      await client.query(`
        INSERT INTO promo_codes (code, discount_type, discount_percent, discount_value_paise, min_order_paise, max_discount_paise, valid_from, valid_until, max_uses)
        VALUES ('2QT50', 'percent', 50, 0, 10000, 5000, NOW(), NOW() + interval '1 month', 1000)
        ON CONFLICT DO NOTHING
      `);

      // 6. Create Test Users (Passwordless, uses OTP/PIN)
      const riderPhone = '918888888888';
      const chefPhone = '917777777777';
      const customerPhone = '919999999999';
      const adminPhone = '910000000000';

      await client.query(`
        INSERT INTO users (phone, role, name)
        VALUES ($1, 'super_admin', 'Admin Commander')
        ON CONFLICT (phone) DO UPDATE SET role = 'super_admin'
      `, [adminPhone]);

      await client.query(`
        INSERT INTO users (phone, role, name, zone_id)
        VALUES ($1, 'rider', 'Test Rider', $2)
        ON CONFLICT (phone) DO UPDATE SET role = 'rider', zone_id = $2
      `, [riderPhone, zoneId]);

      await client.query(`
        INSERT INTO users (phone, role, name, kitchen_id)
        VALUES ($1, 'chef', 'Test Chef', $2)
        ON CONFLICT (phone) DO UPDATE SET role = 'chef', kitchen_id = $2
      `, [chefPhone, kitchenId]);

      await client.query(`
        INSERT INTO users (phone, role, name)
        VALUES ($1, 'customer', 'Test Customer')
        ON CONFLICT (phone) DO UPDATE SET role = 'customer'
      `, [customerPhone]);

      console.log('[SEED] Seed completed successfully!');
    });
  } catch (err) {
    console.error('[SEED] Seed failed:', err);
  }
};

seed();
