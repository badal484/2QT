const axios = require('axios');

async function test() {
  try {
    const { Pool } = require('pg');
    require('dotenv').config();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRes = await pool.query("SELECT id, phone FROM users LIMIT 1");
    if (userRes.rows.length === 0) {
      await pool.query("INSERT INTO users (name, phone) VALUES ('Test', '9999999999')");
    }

    const authRes = await axios.post('http://localhost:8000/api/v1/auth/send-otp', { phone: '9999999999', role: 'customer' });
    const verifyRes = await axios.post('http://localhost:8000/api/v1/auth/verify-otp', { phone: '9999999999', otp: authRes.data.devOtp, role: 'customer' });
    const token = verifyRes.data.accessToken;

    const zoneRes = await pool.query("SELECT id FROM zones LIMIT 1");
    const zoneId = zoneRes.rows[0].id;

    const postRes = await axios.post('http://localhost:8000/api/v1/customers/addresses', {
        label: 'Home',
        addressText: 'T4, Keredari',
        // MISSING LAT AND LNG
        zoneId: zoneId
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Success:", postRes.data);
  } catch (e) {
    if (e.response) {
      console.log("Error status:", e.response.status);
      console.log("Error html/json:", e.response.data);
    } else {
      console.error(e.message);
    }
  }
}
test();
