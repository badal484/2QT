const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = 'http://localhost:8000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const crypto = require('crypto');

async function test() {
  const res = await axios.post(`${API}/auth/send-otp`, { phone: '915555555555' });
  const auth = await axios.post(`${API}/auth/verify-otp`, { phone: '915555555555', otp: '123456' });
  const token = auth.data.accessToken;
  console.log("Got token");
  const addrs = await axios.get(`${API}/customers/addresses`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(addrs.data);
}
test().catch(console.error);
