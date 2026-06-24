const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API = 'http://localhost:8000/api/v1';

async function run() {
  console.log("Starting Deep E2E Flow Check...");
  try {
    // 1. Setup Test Users
    console.log("Setting up users...");
    await pool.query("DELETE FROM loyalty_transactions WHERE customer_id IN (SELECT id FROM users WHERE phone IN ('911111111111', '912222222222', '913333333333'))");
    await pool.query("DELETE FROM wallet_transactions WHERE customer_id IN (SELECT id FROM users WHERE phone IN ('911111111111', '912222222222', '913333333333'))");
    await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE phone IN ('911111111111', '912222222222', '913333333333')))");
    await pool.query("DELETE FROM orders WHERE customer_id IN (SELECT id FROM users WHERE phone IN ('911111111111', '912222222222', '913333333333'))");
    await pool.query("DELETE FROM addresses WHERE customer_id IN (SELECT id FROM users WHERE phone IN ('911111111111', '912222222222', '913333333333'))");
    await pool.query(`INSERT INTO users (phone, name, role, is_active) VALUES ('911111111111', 'Test Customer', 'customer', true) ON CONFLICT (phone) DO UPDATE SET role='customer', is_active=true`);
    await pool.query(`INSERT INTO users (phone, name, role, is_active, current_order_id) VALUES ('912222222222', 'Test Chef', 'chef', true, NULL) ON CONFLICT (phone) DO UPDATE SET role='chef', is_active=true, current_order_id=NULL`);
    await pool.query(`INSERT INTO users (phone, name, role, is_active, is_verified, is_online, current_order_id) VALUES ('913333333333', 'Test Rider', 'rider', true, true, true, NULL) ON CONFLICT (phone) DO UPDATE SET role='rider', is_verified=true, is_online=true, is_active=true, current_order_id=NULL`);

    const getAuth = async (phone) => {
      const sendRes = await axios.post(`${API}/auth/send-otp`, { phone });
      const otp = sendRes.data.devOtp || '123456';
      const res = await axios.post(`${API}/auth/verify-otp`, { phone, otp });
      return res.data.accessToken;
    };

    const cToken = await getAuth('911111111111');
    const kToken = await getAuth('912222222222');
    const rToken = await getAuth('913333333333');
    console.log("Tokens generated");

    // Setup Zone and Kitchen
    const zCheck = await pool.query(`SELECT id FROM zones WHERE name='Test Zone'`);
    let zoneId;
    if (zCheck.rows.length === 0) {
      const zIns = await pool.query(`INSERT INTO zones (name, radius_km, kitchen_lat, kitchen_lng) VALUES ('Test Zone', 5.0, 12.97, 77.59) RETURNING id`);
      zoneId = zIns.rows[0].id;
    } else {
      zoneId = zCheck.rows[0].id;
    }
    console.log("Zone setup:", zoneId);
    
    const kRes = await pool.query(`SELECT id FROM users WHERE phone='912222222222'`);
    const kUserId = kRes.rows[0].id;
    
    const kCheck = await pool.query(`SELECT id FROM kitchens WHERE name='Test Kitchen'`);
    let kitchenId;
    if (kCheck.rows.length === 0) {
      const kIns = await pool.query(`INSERT INTO kitchens (name, address, is_active, lat, lng) VALUES ('Test Kitchen', 'Kitchen Addr', true, 12.97, 77.59) RETURNING id`);
      kitchenId = kIns.rows[0].id;
    } else {
      kitchenId = kCheck.rows[0].id;
    }
    await pool.query(`INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [kitchenId, zoneId]);
    console.log("Kitchen setup:", kitchenId);
    
    await pool.query(`UPDATE users SET kitchen_id = $1 WHERE id = $2`, [kitchenId, kUserId]);

    // Create a Menu Item
    const mCheck = await pool.query(`SELECT id FROM menu_items WHERE name='Test Item'`);
    if (mCheck.rows.length === 0) {
      await pool.query(`INSERT INTO menu_items (name, description, price_paise, cost_price_paise, category, zone_id) VALUES ('Test Item', 'Desc', 10000, 8000, 'Test', $1)`, [zoneId]);
    }
    console.log("Menu Item setup");

    // 2. Customer adds address
    let cAddressId;
    const addrs = await axios.get(`${API}/customers/addresses`, { headers: { Authorization: `Bearer ${cToken}` } });
    if (addrs.data.addresses.length === 0) {
      const newAddr = await axios.post(`${API}/customers/addresses`, { label: 'Home', addressText: 'Customer House', lat: 12.98, lng: 77.60, zoneId: zoneId }, { headers: { Authorization: `Bearer ${cToken}` } });
      cAddressId = newAddr.data.address.id;
    } else { cAddressId = addrs.data.addresses[0].id; }
    console.log("Customer Address setup");

    // 3. Customer Order
    console.log("Customer placing order...");
    const menu = await axios.get(`${API}/menu?zoneId=${zoneId}`);
    const itemId = menu.data.items[0].id;
    const checkout = await axios.post(`${API}/payments/create-order`, { 
      items: [{ menuItemId: itemId, quantity: 1 }], 
      addressId: cAddressId,
      paymentMethod: 'cod'
    }, { headers: { Authorization: `Bearer ${cToken}` } });
    const orderId = checkout.data.orderId;
    console.log("✅ Order created:", orderId);

    // 4. Kitchen Accepts
    console.log("Kitchen accepting order...");
    await axios.patch(`${API}/kitchen/orders/${orderId}/status`, { status: 'preparing' }, { headers: { Authorization: `Bearer ${kToken}` } });
    console.log("✅ Kitchen preparing");

    // 5. Kitchen Ready
    await axios.patch(`${API}/kitchen/orders/${orderId}/status`, { status: 'ready_for_pickup' }, { headers: { Authorization: `Bearer ${kToken}` } });
    console.log("✅ Kitchen ready");

    // 6. Rider Pool
    console.log("Rider checking pool...");
    const poolRes = await axios.get(`${API}/riders/orders/pool`, { headers: { Authorization: `Bearer ${rToken}` } });
    console.log("Pool has orders:", poolRes.data.orders.length);

    // 7. Rider Claim
    console.log("Rider claiming order...");
    await axios.post(`${API}/riders/orders/${orderId}/claim`, {}, { headers: { Authorization: `Bearer ${rToken}` } });
    console.log("✅ Rider claimed");

    // 8. Rider out for delivery
    await axios.patch(`${API}/riders/orders/${orderId}/status`, { status: 'out_for_delivery' }, { headers: { Authorization: `Bearer ${rToken}` } });
    console.log("✅ Rider out for delivery");

    // 9. Deliver with OTP
    // Get OTP from DB
    const otpRes = await pool.query(`SELECT delivery_otp FROM orders WHERE id=$1`, [orderId]);
    const otp = otpRes.rows[0].delivery_otp;
    console.log("OTP is:", otp);

    const verify = await axios.post(`${API}/riders/verify-otp`, { orderId, otp }, { headers: { Authorization: `Bearer ${rToken}` } });
    console.log("✅ OTP verified");

    // Update status to delivered
    await axios.patch(`${API}/riders/orders/${orderId}/status`, { status: 'delivered' }, { headers: { Authorization: `Bearer ${rToken}` } });
    console.log("✅ Order delivered successfully!");

  } catch (err) {
    console.error("❌ Test Failed:");
    if (err.response) {
      console.error("  Status:", err.response.status);
      console.error("  Data:", JSON.stringify(err.response.data, null, 2));
      console.error("  URL:", err.config?.url);
    } else if (err.message) {
      console.error("  Message:", err.message);
      console.error("  Stack:", err.stack);
    } else {
      console.error("  Raw:", err);
    }
  } finally {
    pool.end();
  }
}
run();
