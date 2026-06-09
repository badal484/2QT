const jwt = require('jsonwebtoken');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config({ path: __dirname + '/backend/.env' });
const fetch = require('node-fetch'); // wait I can't use node-fetch. I will use axios or global fetch if node > 18.

async function run() {
  const token = jwt.sign({ userId: '1', role: 'customer', jti: 'test' }, process.env.JWT_SECRET || 'secret');
  
  const form = new FormData();
  form.append('image', fs.createReadStream('test.jpg'));

  // global fetch is available in Node 18+ but FormData might need to be passed correctly
  // Let's just use axios since it might be in node_modules
  const axios = require('axios');
  try {
    const res = await axios.post('http://localhost:8000/api/v1/upload/image', form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      }
    });
    console.log("SUCCESS:", res.data);
  } catch (err) {
    console.log("ERROR:", err.response ? err.response.data : err.message);
  }
}
run();
