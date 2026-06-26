const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ userId: 'd3f39773-83a0-4d37-b0e0-71ee6f560b16', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const fetch = require('node-fetch');

async function test() {
  const patchRes = await fetch('http://localhost:8000/api/v1/admin/zones/b11db2e5-0238-40d9-bc0b-ebc2c0f18ca9', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      name: "Bachra ",
      delivery_fee_base_paise: 2500,
      max_orders_per_hour: 60,
      realistic_delivery_minutes: 15,
      opening_time: "10:00:00",
      closing_time: "22:00:00",
      polygon_points: [
          { "lat": 23.77026416023979, "lng": 84.72656250000001 }
      ],
      kitchen_lat: 23.6370,
      kitchen_lng: 85.3374
    })
  });
  const text = await patchRes.text();
  console.log(patchRes.status, text);
}
test().catch(console.error);
