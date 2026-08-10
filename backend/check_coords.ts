import { query } from './src/db';

async function run() {
  try {
    const { rows: addresses } = await query('SELECT lat, lng, address_text FROM addresses ORDER BY created_at DESC LIMIT 1');
    const addr = addresses[0];
    console.log('--- USER ADDRESS ---');
    console.log(addr);

    const { rows: kitchens } = await query(`
      SELECT k.lat, k.lng, k.name 
      FROM kitchens k
      JOIN kitchen_zones kz ON k.id = kz.kitchen_id
      JOIN zones z ON z.id = kz.zone_id
      WHERE z.name ILIKE '%polaris%'
      LIMIT 1
    `);
    const kitchen = kitchens[0];
    console.log('--- KITCHEN ---');
    console.log(kitchen);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
run();
