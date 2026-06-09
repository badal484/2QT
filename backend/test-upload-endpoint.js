require('dotenv').config({ path: __dirname + '/.env' });
const jwt = require('jsonwebtoken');
const fs = require('fs');
const token = jwt.sign({ userId: 'dummy', role: 'rider', jti: 'dummy-jti' }, process.env.JWT_SECRET || 'secret');

fetch('http://localhost:8000/api/v1/upload/image', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: (() => {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('image', fs.createReadStream('/Users/badal11/Desktop/VELTO_FOOD_PALACE/web/public/window.svg'));
        return form;
    })()
}).then(async r => {
    console.log(r.status, await r.text());
}).catch(console.error);
