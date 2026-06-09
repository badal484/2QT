const fs = require('fs');
const token = require('jsonwebtoken').sign({ id: 'some-id', role: 'super_admin' }, require('dotenv').config().parsed.JWT_SECRET);
const FormData = require('form-data');
const form = new FormData();
form.append('image', fs.createReadStream('test.png'));

fetch('http://localhost:8000/api/v1/admin/menu/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    ...form.getHeaders()
  },
  body: form
}).then(r => r.json()).then(console.log).catch(console.error);
