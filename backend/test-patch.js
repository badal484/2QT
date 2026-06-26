const fetch = require('node-fetch');

async function test() {
  // 1. First get token
  const loginRes = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '916204646300' })
  });
  const { session_id } = await loginRes.json();
  
  const verifyRes = await fetch('http://localhost:8000/api/v1/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '916204646300', code: '123456', session_id })
  });
  const { token } = await verifyRes.json();
  
  // 2. Try PATCH
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
          {
            "lat": 23.77026416023979,
            "lng": 84.72656250000001
          },
          {
            "lat": 22.849601761797313,
            "lng": 85.0396728515625
          },
          {
            "lat": 22.85972558644609,
            "lng": 86.2646484375
          },
          {
            "lat": 23.807962494353514,
            "lng": 85.946044921875
          },
          {
            "lat": 24.25948538299899,
            "lng": 85.25390625000001
          },
          {
            "lat": 24.27513468493838,
            "lng": 84.79385375976564
          }
        ],
      kitchen_lat: 23.6370,
      kitchen_lng: 85.3374
    })
  });
  const json = await patchRes.json();
  console.log(patchRes.status, json);
}
test().catch(console.error);
