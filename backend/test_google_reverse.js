require('dotenv').config({ path: 'backend/.env' });
const axios = require('axios');

async function run() {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!GOOGLE_MAPS_API_KEY) { console.log('No key'); return; }
  
  const kLat = 12.9709;
  const kLng = 77.7125;
  const uLat = 12.9747751;
  const uLng = 77.7129663;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${uLat},${uLng}&destinations=${kLat},${kLng}&key=${GOOGLE_MAPS_API_KEY}`;
  
  try {
    const res = await axios.get(url);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
