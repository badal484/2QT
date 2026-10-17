/**
 * Phase C.2: Real PostgreSQL Integration Test Runner
 * 
 * Invokes the dedicated PostgreSQL concurrency integration test suite
 * against a disposable local database.
 * 
 * Safety:
 * - Never runs against remote or staging/production database.
 * - Uses a disposable database that is created and dropped per test run.
 */

const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../../scratch/run_postgres_concurrency_tests.sh');

function run() {
    console.log('[INTEGRATION_TEST_RUNNER] Running Phase C.2 Real PostgreSQL Concurrency Integration Tests...');
    try {
        // Create disposable db if not already created
        try { execSync('dropdb velto_c2_integration_disposable 2>/dev/null || true'); } catch (_) {}
        execSync('createdb velto_c2_integration_disposable');
        execSync(`psql -d velto_c2_integration_disposable -c "
            CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, is_active BOOLEAN DEFAULT true, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
            CREATE TABLE orders (id TEXT PRIMARY KEY, display_id TEXT, customer_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending_payment', created_at TIMESTAMPTZ DEFAULT NOW());
            CREATE TABLE scheduled_orders (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'scheduled', scheduled_for TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
            CREATE TABLE addresses (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), street TEXT);
            CREATE TABLE device_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token TEXT);
            CREATE TABLE refresh_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token TEXT, revoked_at TIMESTAMPTZ);
        "`);

        const output = execSync(`bash "${scriptPath}"`, { encoding: 'utf8', stdio: 'inherit' });
        console.log('[INTEGRATION_TEST_RUNNER] All PostgreSQL integration tests completed successfully.');
    } catch (err) {
        console.error('[INTEGRATION_TEST_RUNNER] Integration tests failed:', err.message);
        process.exitCode = 1;
    } finally {
        try {
            execSync('dropdb velto_c2_integration_disposable 2>/dev/null || true');
            console.log('[INTEGRATION_TEST_RUNNER] Cleaned up disposable database.');
        } catch (_) {}
    }
}

run();
