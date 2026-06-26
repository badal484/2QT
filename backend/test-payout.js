const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API = 'http://localhost:8000/api/v1';

async function run() {
  const getAuth = async (phone) => {
      const sendRes = await axios.post(`${API}/auth/send-otp`, { phone });
      const otp = sendRes.data.devOtp || '123456';
      const res = await axios.post(`${API}/auth/verify-otp`, { phone, otp });
      return res.data.accessToken;
  };

  const rToken = await getAuth('913333333333');
  try {
      await axios.post(`${API}/riders/payouts/request`, { amountPaise: 10000 }, { headers: { Authorization: `Bearer ${rToken}` } });
      console.log("Payout success!");
  } catch(e) {
      console.log("Payout failed:", e.response?.data || e.message);
  }
  pool.end();
}
run();
