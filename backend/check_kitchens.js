require('dotenv').config({ path: 'backend/.env' });
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres' });
  try {
    await client.connect();
    const { rows: kitchens } = await client.query("SELECT id, name, lat, lng, is_active FROM kitchens");
    console.log('Kitchens:', kitchens);
    
    const { rows: zones } = await client.query("SELECT * FROM kitchen_zones");
    console.log('Kitchen Zones:', zones);
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
