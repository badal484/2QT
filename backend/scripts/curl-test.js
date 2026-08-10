const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = 'http://localhost:8000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const crypto = require('crypto');

const token = jwt.sign(
  { userId: '11111111-1111-1111-1111-111111111111', role: 'customer', jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: '1d' }
);

axios.get(`${API}/customers/addresses`, { headers: { Authorization: `Bearer ${token}` } })
  .then(console.log)
  .catch(err => console.error(err.response ? err.response.data : err.message));
