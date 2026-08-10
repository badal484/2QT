const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true' });
  await client.connect();
  
  // Get latest address
  const { rows: addresses } = await client.query('SELECT lat, lng, address_text FROM addresses ORDER BY created_at DESC LIMIT 1');
  const addr = addresses[0];
  console.log('User Address:', addr);

  // Get Polaris kitchen
  const { rows: kitchens } = await client.query(`
    SELECT k.lat, k.lng, k.name 
    FROM kitchens k
    JOIN kitchen_zones kz ON k.id = kz.kitchen_id
    JOIN zones z ON z.id = kz.zone_id
    WHERE z.name ILIKE '%polaris%'
    LIMIT 1
  `);
  const kitchen = kitchens[0];
  console.log('Kitchen:', kitchen);
  
  if (addr && kitchen) {
    // Haversine formula (same as getDistanceKm in backend)
    const R = 6371; // km
    const dLat = (kitchen.lat - addr.lat) * Math.PI / 180;
    const dLon = (kitchen.lng - addr.lng) * Math.PI / 180;
    const lat1 = addr.lat * Math.PI / 180;
    const lat2 = kitchen.lat * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c;
    console.log('Calculated Distance (Straight line):', d, 'km');
  }

  process.exit();
}
run();
