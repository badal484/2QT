require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    const res = await client.query("SELECT id FROM kitchens WHERE name = '2QT Central Kitchen' ORDER BY created_at ASC");
    const ids = res.rows.map(r => r.id);
    if (ids.length <= 1) {
       console.log('No duplicates found.');
       return;
    }
    // Keep the oldest one
    const idsToDelete = ids.slice(1);
    
    // First, delete links
    for (const id of idsToDelete) {
        await client.query('DELETE FROM kitchen_zones WHERE kitchen_id = $1', [id]);
        try {
            await client.query('UPDATE users SET kitchen_id = NULL WHERE kitchen_id = $1', [id]);
        } catch (e) {
            console.log("No users table or kitchen_id column, skipping");
        }
        await client.query('DELETE FROM kitchens WHERE id = $1', [id]);
    }
    
    console.log('Deleted ' + idsToDelete.length + ' duplicates.');
  } catch (err) {
    console.error(err);
  } finally {
    client.end();
  }
});
