const http = require('http');
fetch('http://localhost:3000/api/v1/upload/image', {
  method: 'POST',
  body: 'test'
}).then(async r => {
  console.log("Response from 3000:", await r.text());
}).catch(console.error);
