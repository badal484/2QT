#!/usr/bin/env node
// One-shot migration runner — uses session mode pooler (port 5432) so DDL works
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Switch from pgbouncer transaction mode (6543) to session mode (5432)
const sessionUrl = (process.env.DATABASE_URL || '')
  .replace(':6543/', ':5432/')
  .replace('?pgbouncer=true', '');

const MIGRATIONS = [
  '047_finance_system.sql',
  '048_cod_pending_status.sql',
  '049_world_class_offers.sql',
  '050_complaints.sql',
  '051_cash_submit.sql',
  '052_auto_payouts.sql',
  '053_partner_kitchen_setup.sql',
  '054_notifications.sql',
  '064_menu_item_badges.sql',
];

async function run() {
  const client = new Client({ connectionString: sessionUrl });
  await client.connect();
  console.log('Connected to Supabase (session mode)\n');

  // Ensure migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      ran_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  for (const file of MIGRATIONS) {
    const filePath = path.join(__dirname, 'migrations', file);
    if (!fs.existsSync(filePath)) {
      console.log(`  skip  ${file}  (file not found)`);
      continue;
    }
    // Skip already-ran migrations
    const { rows } = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if (rows.length) {
      console.log(`  skip  ${file}  (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓     ${file}`);
    } catch (err) {
      console.error(`  ✗     ${file}`, err.message);
      // Continue with remaining migrations instead of crashing
    }
  }

  await client.end();
  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
