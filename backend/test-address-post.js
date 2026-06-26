const axios = require('axios');
const fs = require('fs');

async function test() {
  try {
    // We need a token. I'll read it from env if possible, or I'll just login as a user.
    // Let's create a user and get a token.
    const { Pool } = require('pg');
    require('dotenv').config({ path: 'backend/.env' });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRes = await pool.query("SELECT id, phone FROM users WHERE phone = '9999999999' LIMIT 1");
    let phone = '9999999999';
    if (userRes.rows.length === 0) {
      await pool.query("INSERT INTO users (name, phone) VALUES ('Test', '9999999999')");
    }

    // Call API
    const authRes = await axios.post('http://localhost:3000/auth/request-otp', { phone: '9999999999', role: 'customer' });
    const verifyRes = await axios.post('http://localhost:3000/auth/verify-otp', { phone: '9999999999', otp: '123456', role: 'customer' });
    const token = verifyRes.data.accessToken;

    const zoneRes = await pool.query("SELECT id FROM zones LIMIT 1");
    const zoneId = zoneRes.rows[0].id;

    const postRes = await axios.post('http://localhost:3000/customers/addresses', {
        label: 'Home',
        addressText: 'T4, Keredari',
        lat: 12.34,
        lng: 56.78,
        zoneId: zoneId
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Success:", postRes.data);
  } catch (e) {
    if (e.response) {
      console.log("Error status:", e.response.status);
      console.log("Error data:", e.response.data);
    } else {
      console.error(e.message);
    }
  }
}
test();
