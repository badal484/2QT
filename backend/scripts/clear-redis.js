const { createClient } = require('redis');
require('dotenv').config();

async function clear() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const keys = await client.keys('menu:*');
  if (keys.length > 0) {
    await client.del(keys);
    console.log('Cleared redis cache for menus', keys);
  } else {
    console.log('No keys to clear');
  }
  await client.disconnect();
}
clear();
