// One-shot migration runner — runs against Supabase direct connection (bypasses pgbouncer)
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Build direct connection URL (no pgbouncer) from the pooler URL
// Pooler: postgresql://postgres.PROJECT@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
// Direct: postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres
const poolerUrl = process.env.DATABASE_URL;
const match = poolerUrl.match(/postgresql:\/\/postgres\.([^:]+):([^@]+)@/);
const projectRef = match ? match[1] : null;
const password = match ? match[2] : null;

if (!projectRef) {
    console.error('Could not parse project ref from DATABASE_URL');
    process.exit(1);
}

const directUrl = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

async function runMigration(file) {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
    const client = new Client({
        connectionString: directUrl,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log(`\nRunning migration: ${file}`);
    try {
        await client.query(sql);
        console.log(`✓ ${file} — done`);
    } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log(`~ ${file} — already applied (skipped)`);
        } else {
            throw err;
        }
    } finally {
        await client.end();
    }
}

(async () => {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.error('Usage: node run-migration.js <file.sql> [file2.sql ...]');
        process.exit(1);
    }
    for (const f of files) {
        await runMigration(f);
    }
    console.log('\nAll migrations complete.');
})().catch(err => {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
});
