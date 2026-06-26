import { query } from './src/db';
async function run() {
  try {
    const res = await query("SELECT id FROM users WHERE role='super_admin' LIMIT 1");
    console.log("ADMIN ID:", res.rows[0].id);
  } catch (e) { console.error(e); }
  process.exit();
}
run();
