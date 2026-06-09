const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testUpload() {
  try {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5MWYyMGZiNi1kZThjLTRhYjUtOTc1NC0zYmI5YmY5YzU4YmMiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJraXRjaGVuSWQiOm51bGwsInpvbmVJZCI6bnVsbCwianRpIjoiMWQ2YzMxZWEtOGJkMy00Zjg4LTlhZGEtYjMzNGIyYzY2MGJmIiwiaWF0IjoxNzgwMzE4MjczLCJleHAiOjE3ODAzMTkxNzN9.pfvReUTxBnXX22OhEubOK71Ng_OqyNx7sUBipuxynow";
    
    // test upload
    const form = new FormData();
    form.append('image', fs.createReadStream('dummy.png'));
    
    console.log('Sending upload request...');
    const uploadRes = await axios.post('http://localhost:8000/api/v1/admin/menu/upload', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    console.log('Upload success:', uploadRes.data);
  } catch (err) {
    console.error('Upload failed:', err.response ? err.response.data : err.message);
  }
}
testUpload();
