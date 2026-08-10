const fs = require('fs');
const token = require('jsonwebtoken').sign({ id: 'some-id', role: 'super_admin' }, require('dotenv').config().parsed.JWT_SECRET);
const axios = require('axios');
const FormData = require('form-data');

async function test() {
  const form = new FormData();
  form.append('image', fs.createReadStream('test.png'));

  try {
    const res = await axios.post('http://localhost:8000/api/v1/admin/menu/upload', form, {
      headers: {
        'Authorization': 'Bearer ' + token,
        ...form.getHeaders()
      }
    });
    console.log("Status:", res.status);
    console.log("Body:", res.data);
  } catch (err) {
    console.error("Fetch failed:", err.response ? err.response.data : err.message);
  }
}
test();
