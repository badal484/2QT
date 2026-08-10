const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ userId: 'some-id', role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

fetch('http://localhost:8000/api/v1/admin/zones', { headers: { Authorization: `Bearer ${token}` } })
  .then(r => r.text())
  .then(t => console.log(t))
  .catch(e => console.error(e));
