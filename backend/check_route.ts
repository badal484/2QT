import { query } from './src/db';
require('dotenv').config();

async function run() {
  try {
    const { rows: addresses } = await query('SELECT lat, lng, address_text FROM addresses ORDER BY created_at DESC LIMIT 1');
    const addr = addresses[0];
    
    const { rows: kitchens } = await query(`
      SELECT k.lat, k.lng, k.name 
      FROM kitchens k
      JOIN kitchen_zones kz ON k.id = kz.kitchen_id
      JOIN zones z ON z.id = kz.zone_id
      WHERE z.name ILIKE '%polaris%'
      LIMIT 1
    `);
    const kitchen = kitchens[0];
    
    if (addr && kitchen) {
      console.log(`\nGoogle Maps URL:\nhttps://www.google.com/maps/dir/${kitchen.lat},${kitchen.lng}/${addr.lat},${addr.lng}\n`);
    } else {
      console.log('Address or kitchen not found');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
  }
  process.exit();
}
run();
