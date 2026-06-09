const FormData = require('form-data');
const fs = require('fs');

async function upload() {
  const form = new FormData();
  form.append('image', fs.createReadStream('test-upload.js')); // dummy file
  const res = await fetch('http://localhost:8000/api/v1/upload/image', {
    method: 'POST',
    body: form
  });
  const text = await res.text();
  console.log("RESPONSE:", text);
}
upload();
