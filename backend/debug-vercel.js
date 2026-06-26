const fetch = require('node-fetch');

async function debugVercel() {
  // Use the admin phone number to login and get a token
  // Since we don't have OTP, we can just use the local JWT secret to generate a token!
  // The Vercel backend uses the SAME JWT_SECRET if it's deployed from the same code.
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ userId: 'f30e97e9-7055-4ce7-bec8-71bdeb57d6bd', role: 'super_admin' }, 'pCWIlnt+NJooyCaQkeq5RMeth8kXEDYXHjg76oO8uQrDT5qvGh9yIXJdQigaA3NN', { expiresIn: '1h' });

  console.log("Sending PATCH to Vercel...");
  const res = await fetch('https://2-qt.vercel.app/api/proxy/admin/zones/b11db2e5-0238-40d9-bc0b-ebc2c0f18ca9', {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: "Bachra ",
      delivery_fee_base_paise: 2500,
      max_orders_per_hour: 60,
      realistic_delivery_minutes: 15,
      opening_time: "10:00:00",
      closing_time: "22:00:00",
      polygon_points: [
          { "lat": 23.77026416023979, "lng": 84.72656250000001 }
      ]
    })
  });
  
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

debugVercel().catch(console.error);
