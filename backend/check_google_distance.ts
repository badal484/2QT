import axios from 'axios';
import { query } from './src/db';
require('dotenv').config({ path: '.env' });

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
      console.log('User:', addr.lat, addr.lng);
      console.log('Kitchen:', kitchen.lat, kitchen.lng);
      
      const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No API Key');
      
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${kitchen.lat},${kitchen.lng}&destinations=${addr.lat},${addr.lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await axios.get(url);
      console.log(JSON.stringify(res.data, null, 2));

      // Haversine
      const R = 6371; // km
      const dLat = (kitchen.lat - addr.lat) * Math.PI / 180;
      const dLon = (kitchen.lng - addr.lng) * Math.PI / 180;
      const lat1 = addr.lat * Math.PI / 180;
      const lat2 = kitchen.lat * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      console.log('Straight line (Haversine):', R * c, 'km');
    }
  } catch(e: any) { console.error(e.message); }
  process.exit();
}
run();
