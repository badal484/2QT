const { sendFCM } = require('./dist/services/fcm.service');
const { query } = require('./dist/db');

async function main() {
  const { rows } = await query("SELECT id, name, phone, device_token FROM users WHERE device_token IS NOT NULL");
  console.log(`Found ${rows.length} users with device_token:`);
  
  for (const u of rows) {
    console.log(`Sending test push to User: ${u.name} (${u.phone}), Token: ${u.device_token.slice(0, 20)}...`);
    try {
      const res = await sendFCM(
        u.device_token,
        '🔔 2QT Test Notification',
        'This is a live test notification from 2QT server!',
        { type: 'order_confirmed', displayId: 'TEST-123' }
      );
      console.log(`Result for ${u.phone}: ${res}`);
    } catch (err) {
      console.error(`Error sending to ${u.phone}:`, err.message);
    }
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
