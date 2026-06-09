const fs = require('fs');
const token = require('jsonwebtoken').sign({ id: 'some-id', role: 'super_admin' }, require('dotenv').config().parsed.JWT_SECRET);
const fetch = require('node-fetch'); // we need to install node-fetch or use native fetch correctly
const FormData = require('form-data');

async function test() {
  const form = new FormData();
  form.append('image', fs.createReadStream('test.png'));

  try {
    const res = await fetch('http://localhost:8000/api/v1/admin/menu/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: form
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
