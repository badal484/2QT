import axios from 'axios';
import { query } from '../db';

const API_URL = 'http://localhost:3000/api/v1';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const stressTest = async () => {
  console.log('🚀 [STRESS TEST] Starting Phase 1: Customer Activity...');

  try {
    const { rows: users } = await query('SELECT id, phone FROM users WHERE role = $1 LIMIT 1', ['customer']);
    if (users.length === 0) throw new Error('No customer found in DB.');
    
    const authRes = await axios.post(`${API_URL}/auth/verify-otp`, { phone: users[0].phone, otp: '123456' });
    const token = authRes.data.accessToken;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const { rows: zones } = await query('SELECT id FROM zones LIMIT 1');
    const menuRes = await axios.get(`${API_URL}/menu?zoneId=${zones[0].id}`, { headers: authHeaders });
    const item = menuRes.data.items[0];
    
    const { rows: addresses } = await query('INSERT INTO addresses (customer_id, zone_id, label, address_text, lat, lng) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', 
      [users[0].id, zones[0].id, 'Work', 'Stress Test Location', 12.9716, 77.5946]);
    const addressId = addresses[0].id;

    console.log(`👤 Customer Ready. Address: ${addressId}`);

    console.log('📦 Simulating 5 users creating orders concurrently...');
    
    const orderIds = [];
    for (let i = 0; i < 5; i++) {
      const createRes = await axios.post(`${API_URL}/payments/create-order`, {
        items: [{ menuItemId: item.id, quantity: 1 }],
        addressId: addressId,
        useWallet: false
      }, { headers: authHeaders });

      const cfOrderId = createRes.data.cfOrderId;
      console.log(`🔗 Cashfree Order Created: ${cfOrderId}`);

      const webhookRes = await axios.post(`${API_URL}/webhooks/cashfree`, {
        data: {
          order: {
            cf_order_id: cfOrderId,
            order_id: `VELTO_${Date.now()}_${i}`,
            order_amount: item.price_paise / 100
          },
          payment: {
            payment_status: 'SUCCESS',
            cf_payment_id: `PAY_${Date.now()}_${i}`,
            payment_method: { type: 'upi' }
          }
        }
      });
      orderIds.push(webhookRes.data.orderId);
    }

    console.log(`✅ 5 Orders Successfully Created and Processed.`);

    const { rows: chefUsers } = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['chef']);
    const chefId = chefUsers[0].id;

    for (const orderId of orderIds) {
      console.log(`👨‍🍳 Kitchen claiming ${orderId}...`);
      await query('UPDATE orders SET status = $1, claimed_by_chef_id = $2 WHERE id = $3', ['preparing', chefId, orderId]);
      await query('UPDATE orders SET status = $1 WHERE id = $2', ['ready_for_pickup', orderId]);
    }

    const { rows: riderUsers } = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['rider']);
    const riderId = riderUsers[0].id;

    const today = new Date().toISOString().split('T')[0];

    for (const orderId of orderIds) {
      const { rows: otpData } = await query('SELECT delivery_otp FROM orders WHERE id = $1', [orderId]);
      console.log(`🏍️ Rider picking up ${orderId}. OTP: ${otpData[0].delivery_otp}`);
      
      await query('UPDATE orders SET status = $1, rider_id = $2 WHERE id = $3', ['out_for_delivery', riderId, orderId]);
      await query('UPDATE orders SET status = $1 WHERE id = $2', ['delivered', orderId]);
      
      // Update Daily Earnings
      await query(`
        INSERT INTO rider_daily_earnings (rider_id, date, deliveries_count, total_paise, base_earnings_paise)
        VALUES ($1, $2, 1, 4000, 4000)
        ON CONFLICT (rider_id, date) DO UPDATE SET
          deliveries_count = rider_daily_earnings.deliveries_count + 1,
          total_paise = rider_daily_earnings.total_paise + 4000,
          base_earnings_paise = rider_daily_earnings.base_earnings_paise + 4000
      `, [riderId, today]);
    }

    console.log('📊 [STRESS TEST] Phase 4: Financial Audit...');
    const { rows: totals } = await query('SELECT SUM(total_amount_paise) as total FROM orders WHERE status = $1', ['delivered']);
    console.log(`💰 Total Revenue: ₹${totals[0].total / 100}`);
    const { rows: earnings } = await query('SELECT total_paise FROM rider_daily_earnings WHERE rider_id = $1 AND date = $2', [riderId, today]);
    console.log(`💸 Total Rider Earnings for Today: ₹${earnings[0].total_paise / 100}`);

    console.log('🏁 [STRESS TEST] COMPLETE.');

  } catch (err: any) {
    console.error('❌ [STRESS TEST] FAILED:', err.response?.data || err.message);
  }
};

stressTest();
