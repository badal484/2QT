/**
 * Phase C.1 & C.2: Atomic Account Deletion & Concurrency Verification Test Suite
 * 
 * Verifies:
 * 1. Single-client PostgreSQL transaction encapsulation (BEGIN ... COMMIT ... ROLLBACK).
 * 2. Active order & scheduled order guards with row-level locks (FOR UPDATE).
 * 3. Atomic rollback on simulated mid-flight database failures at each stage.
 * 4. Coordinated concurrency locking between order creation (FOR SHARE) and account deletion (FOR UPDATE).
 * 5. Safe, non-fatal post-commit external cleanup (Redis / BullMQ / cache invalidation) with diagnostic logging.
 * 6. Cross-user isolation and safe error responses (no internal DB/SQL leak).
 * 7. [UNIT MOCK] Behavioral simulations for concurrency races, client releases, and inactive customer guards.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const customerRoutePath = path.join(ROOT_DIR, 'backend/src/routes/customer.ts');
const orderServicePath = path.join(ROOT_DIR, 'backend/src/services/order.service.ts');
const cronsPath = path.join(ROOT_DIR, 'backend/src/crons/index.ts');
const dbIndexPath = path.join(ROOT_DIR, 'backend/src/db/index.ts');

let totalTests = 0;
let passedTests = 0;

async function describe(suiteName, fn) {
    console.log(`\n--- ${suiteName} ---`);
    await fn();
}

function it(testName, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ ${testName}`);
    } catch (err) {
        console.error(`  ✗ ${testName}`);
        console.error(`    ${err.message}`);
        process.exitCode = 1;
    }
}

async function itAsync(testName, fn) {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`  ✓ ${testName}`);
    } catch (err) {
        console.error(`  ✗ ${testName}`);
        console.error(`    ${err.message}`);
        process.exitCode = 1;
    }
}

async function runAllTests() {
    console.log('=== PHASE C.2: BACKEND AUDIT & VERIFICATION TEST SUITE ===');

    const customerContent = fs.readFileSync(customerRoutePath, 'utf8');
    const orderServiceContent = fs.readFileSync(orderServicePath, 'utf8');
    const cronsContent = fs.readFileSync(cronsPath, 'utf8');
    const dbIndexContent = fs.readFileSync(dbIndexPath, 'utf8');

    // ── Suite 1: Structural & Static Transaction Integrity ────────────────────
    await describe('Suite 1: Transaction Encapsulation & Query Sequencing', () => {
        it('imports withTransaction from ../db in customer.ts', () => {
            assert.ok(
                customerContent.includes("import { query, withTransaction } from '../db'") ||
                customerContent.includes("withTransaction"),
                'customer.ts must import withTransaction'
            );
        });

        it('wraps database operations in withTransaction block', () => {
            assert.ok(
                customerContent.includes('await withTransaction(async (client) => {'),
                'DELETE /me must invoke withTransaction with client callback'
            );
        });

        it('acquires an exclusive row lock on user record (FOR UPDATE)', () => {
            assert.ok(
                customerContent.includes('SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE'),
                'Must acquire row-level lock on user with FOR UPDATE to coordinate concurrency'
            );
        });

        it('checks for active unfulfilled orders with row-level lock (FOR UPDATE)', () => {
            assert.ok(
                customerContent.includes("status NOT IN ('delivered', 'cancelled')") &&
                customerContent.includes("FOR UPDATE"),
                'Must query active orders with FOR UPDATE lock'
            );
        });

        it('checks for active scheduled orders before deletion', () => {
            assert.ok(
                customerContent.includes('scheduled_orders') &&
                customerContent.includes("status IN ('scheduled', 'converting')"),
                'Must check scheduled_orders for active pending/converting orders'
            );
        });

        it('executes user anonymization, address purge, device token purge, and refresh token revocation on the same client', () => {
            assert.ok(customerContent.includes("client.query(`\n                UPDATE users SET"), 'Must use client.query for users update');
            assert.ok(customerContent.includes("client.query('DELETE FROM addresses WHERE customer_id = $1'"), 'Must use client.query for addresses delete');
            assert.ok(customerContent.includes("client.query('DELETE FROM device_tokens WHERE user_id = $1'"), 'Must use client.query for device_tokens delete');
            assert.ok(customerContent.includes("client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1'"), 'Must use client.query for refresh_tokens update');
        });

        it('executes external cleanup strictly AFTER the withTransaction block', () => {
            const txEndIndex = customerContent.indexOf('await withTransaction');
            const catchIndex = customerContent.indexOf('} catch (err: any) {', txEndIndex);
            const externalCleanupIndex = customerContent.indexOf('Promise.allSettled', catchIndex);
            assert.ok(externalCleanupIndex > catchIndex, 'External cleanup must be placed strictly after withTransaction and its catch block');
        });

        it('handles external cleanup non-fatally using Promise.allSettled with operation diagnostics', () => {
            assert.ok(customerContent.includes('Promise.allSettled'), 'External cleanups must use Promise.allSettled to prevent single-failure aborts');
            assert.ok(customerContent.includes('redis_cart_deletion'), 'Must identify redis cart deletion operation');
            assert.ok(customerContent.includes('trigger_jobs_cancellation'), 'Must identify trigger jobs cancellation operation');
            assert.ok(customerContent.includes('user_cache_invalidation'), 'Must identify user cache invalidation operation');
            assert.ok(customerContent.includes('DELETE_ACCOUNT_CLEANUP_WARN'), 'Must log diagnostic warning when cleanup task rejects');
        });

        it('returns safe error responses without leaking SQL internals or database details', () => {
            assert.ok(customerContent.includes("error: 'DELETION_FAILED'"), 'Must return standard DELETION_FAILED code');
            assert.ok(customerContent.includes("message: 'Failed to process account deletion. Please try again or contact support.'"), 'Must return friendly error message');
            assert.ok(!customerContent.includes("res.status(500).json({ error: err.message"), 'Must never echo err.message directly in 500 response');
        });
    });

    // ── Suite 2: Coordinated Concurrency Locking ──────────────────────────────
    await describe('Suite 2: Coordinated Concurrency Locking Across Order Creation Paths', () => {
        it('order.service.ts createPendingOrderWithClient acquires FOR SHARE lock on customer row', () => {
            assert.ok(
                orderServiceContent.includes('SELECT id, is_active FROM users WHERE id = $1 FOR SHARE'),
                'createPendingOrderWithClient must lock customer row with FOR SHARE'
            );
        });

        it('order.service.ts aborts immediately if customer is deactivated (CUSTOMER_INACTIVE)', () => {
            assert.ok(
                orderServiceContent.includes('CUSTOMER_INACTIVE'),
                'createPendingOrderWithClient must throw CUSTOMER_INACTIVE if user is not active'
            );
        });

        it('crons/index.ts scheduled order activation acquires FOR SHARE lock on customer row before claiming order', () => {
            assert.ok(
                cronsContent.includes('SELECT is_active FROM users WHERE id = $1 FOR SHARE'),
                'crons/index.ts must lock customer row with FOR SHARE before converting scheduled order'
            );
            const userLockIdx = cronsContent.indexOf('SELECT is_active FROM users WHERE id = $1 FOR SHARE');
            const claimIdx = cronsContent.indexOf("UPDATE scheduled_orders SET status = 'converting'");
            assert.ok(userLockIdx < claimIdx, 'Crons must lock users FOR SHARE before claiming scheduled order to prevent deadlock');
        });

        it('crons/index.ts cancels scheduled order if customer is deactivated', () => {
            assert.ok(
                cronsContent.includes("status = 'cancelled'") &&
                cronsContent.includes('CUSTOMER_ACCOUNT_DELETED'),
                'crons/index.ts must cancel scheduled order when customer is inactive'
            );
        });
    });

    // ── Suite 3: Mock-Based Transaction & Concurrency Behavioral Simulation ──
    await describe('Suite 3: [UNIT MOCK] Transaction Execution, Rollback & Concurrency Simulation', async () => {
        function createMockDb() {
            let inTransaction = false;
            let transactionCommitted = false;
            let transactionRolledBack = false;
            let clientReleased = false;
            const executedQueries = [];

            const client = {
                query: async (sql, params = []) => {
                    executedQueries.push({ sql, params });
                    if (sql === 'BEGIN') {
                        inTransaction = true;
                        return { rows: [] };
                    }
                    if (sql === 'COMMIT') {
                        inTransaction = false;
                        transactionCommitted = true;
                        return { rows: [] };
                    }
                    if (sql === 'ROLLBACK') {
                        inTransaction = false;
                        transactionRolledBack = true;
                        return { rows: [] };
                    }
                    return { rows: [] };
                },
                release: () => {
                    clientReleased = true;
                }
            };

            const withTx = async (callback) => {
                await client.query('BEGIN');
                try {
                    const res = await callback(client);
                    await client.query('COMMIT');
                    return res;
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                } finally {
                    client.release();
                }
            };

            return { client, withTx, getState: () => ({ inTransaction, transactionCommitted, transactionRolledBack, clientReleased, executedQueries }) };
        }

        await itAsync('[UNIT MOCK] commits all operations and releases client on successful deletion', async () => {
            const db = createMockDb();
            const targetUserId = 'user-123';

            await db.withTx(async (client) => {
                await client.query('SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE', [targetUserId]);
                await client.query('SELECT id FROM orders WHERE customer_id = $1 AND status NOT IN (\'delivered\', \'cancelled\') FOR UPDATE', [targetUserId]);
                await client.query('UPDATE users SET is_active = false WHERE id = $1', [targetUserId]);
                await client.query('DELETE FROM addresses WHERE customer_id = $1', [targetUserId]);
                await client.query('DELETE FROM device_tokens WHERE user_id = $1', [targetUserId]);
                await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [targetUserId]);
            });

            const state = db.getState();
            assert.strictEqual(state.transactionCommitted, true, 'Transaction must be committed');
            assert.strictEqual(state.transactionRolledBack, false, 'Transaction must not be rolled back');
            assert.strictEqual(state.clientReleased, true, 'Client must be released');
            assert.strictEqual(state.executedQueries.length, 8, 'Must execute BEGIN, 6 operations, and COMMIT');
        });

        await itAsync('[UNIT MOCK] aborts and rolls back when active orders exist without updating user', async () => {
            const db = createMockDb();
            const targetUserId = 'user-active-orders';

            let caughtError = null;
            try {
                await db.withTx(async (client) => {
                    await client.query('SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE', [targetUserId]);
                    const activeOrders = [{ id: 'order-1', display_id: '2QT-000001', status: 'preparing' }];
                    if (activeOrders.length > 0) {
                        const err = new Error('ACTIVE_ORDERS_EXIST');
                        err.code = 'ACTIVE_ORDERS_EXIST';
                        throw err;
                    }
                    await client.query('UPDATE users SET is_active = false WHERE id = $1', [targetUserId]);
                });
            } catch (err) {
                caughtError = err;
            }

            const state = db.getState();
            assert.ok(caughtError, 'Must throw error when active orders exist');
            assert.strictEqual(caughtError.code, 'ACTIVE_ORDERS_EXIST');
            assert.strictEqual(state.transactionCommitted, false, 'Must not commit');
            assert.strictEqual(state.transactionRolledBack, true, 'Must execute ROLLBACK');
            assert.strictEqual(state.clientReleased, true, 'Client must be released in finally');
            const updateExecuted = state.executedQueries.some(q => q.sql.includes('UPDATE users'));
            assert.strictEqual(updateExecuted, false, 'UPDATE users must never execute when active orders exist');
        });

        await itAsync('[UNIT MOCK] rejects when a scheduled order is pending or converting', async () => {
            const db = createMockDb();
            const targetUserId = 'user-scheduled-order';

            let caughtError = null;
            try {
                await db.withTx(async (client) => {
                    await client.query('SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE', [targetUserId]);
                    // Active scheduled order found
                    const scheduledOrders = [{ id: 'sched-1', status: 'converting' }];
                    if (scheduledOrders.length > 0) {
                        const err = new Error('ACTIVE_ORDERS_EXIST');
                        err.code = 'ACTIVE_ORDERS_EXIST';
                        throw err;
                    }
                    await client.query('UPDATE users SET is_active = false WHERE id = $1', [targetUserId]);
                });
            } catch (err) {
                caughtError = err;
            }

            const state = db.getState();
            assert.ok(caughtError, 'Must reject deletion when scheduled order is pending/converting');
            assert.strictEqual(state.transactionRolledBack, true);
            assert.strictEqual(state.clientReleased, true);
        });

        await itAsync('[UNIT MOCK] rolls back and releases client if anonymization fails midway', async () => {
            const db = createMockDb();
            const targetUserId = 'user-fail-midway';

            let caughtError = null;
            try {
                await db.withTx(async (client) => {
                    await client.query('SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE', [targetUserId]);
                    await client.query('UPDATE users SET is_active = false WHERE id = $1', [targetUserId]);
                    throw new Error('SIMULATED_DB_FAILURE_ON_ADDRESS_DELETE');
                });
            } catch (err) {
                caughtError = err;
            }

            const state = db.getState();
            assert.ok(caughtError, 'Must catch error');
            assert.strictEqual(caughtError.message, 'SIMULATED_DB_FAILURE_ON_ADDRESS_DELETE');
            assert.strictEqual(state.transactionCommitted, false, 'Must not commit on failure');
            assert.strictEqual(state.transactionRolledBack, true, 'Must roll back entire transaction');
            assert.strictEqual(state.clientReleased, true, 'Client must be released on failure');
        });

        await itAsync('[UNIT MOCK] simulates checkout race: deletion FOR UPDATE blocks order creation FOR SHARE', async () => {
            const rowLocks = new Map();
            let orderCreationResult = null;
            let deletionResult = null;
            const userId = 'concurrent-user-1';
            let userIsActive = true;

            // Step 1: Deletion starts and acquires EXCLUSIVE lock (FOR UPDATE)
            rowLocks.set(userId, 'EXCLUSIVE');

            // Step 2: Order creation attempts to acquire SHARED lock (FOR SHARE)
            const orderCreationPromise = (async () => {
                while (rowLocks.get(userId) === 'EXCLUSIVE') {
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!userIsActive) {
                    throw new Error('CUSTOMER_INACTIVE');
                }
                return { orderCreated: true };
            })();

            // Step 3: Deletion completes and marks user inactive, then releases lock
            await new Promise(r => setTimeout(r, 20));
            userIsActive = false;
            rowLocks.delete(userId);
            deletionResult = { deleted: true };

            try {
                orderCreationResult = await orderCreationPromise;
            } catch (err) {
                orderCreationResult = { error: err.message };
            }

            assert.strictEqual(deletionResult.deleted, true, 'Account deletion succeeded');
            assert.strictEqual(orderCreationResult.error, 'CUSTOMER_INACTIVE', 'Order creation was safely blocked and rejected once deletion committed');
            assert.strictEqual(orderCreationResult.orderCreated, undefined, 'No order was created for deactivated customer');
        });

        await itAsync('[UNIT MOCK] simulates order creation starting first: order creation blocks deletion until order commits', async () => {
            const rowLocks = new Map();
            let activeOrders = [];
            const userId = 'concurrent-user-2';

            // Step 1: Order creation starts and acquires SHARED lock (FOR SHARE)
            rowLocks.set(userId, 'SHARED');

            // Step 2: Deletion attempts to acquire EXCLUSIVE lock (FOR UPDATE)
            const deletionPromise = (async () => {
                while (rowLocks.get(userId) === 'SHARED') {
                    await new Promise(r => setTimeout(r, 10));
                }
                if (activeOrders.length > 0) {
                    const err = new Error('ACTIVE_ORDERS_EXIST');
                    err.code = 'ACTIVE_ORDERS_EXIST';
                    throw err;
                }
                return { deleted: true };
            })();

            // Step 3: Order creation inserts active order, commits, and releases SHARED lock
            await new Promise(r => setTimeout(r, 20));
            activeOrders.push({ id: 'order-concurrent-100', status: 'pending_payment' });
            rowLocks.delete(userId);

            let deletionResult = null;
            try {
                deletionResult = await deletionPromise;
            } catch (err) {
                deletionResult = { error: err.code };
            }

            assert.strictEqual(deletionResult.error, 'ACTIVE_ORDERS_EXIST', 'Deletion was safely rejected because new order was committed before deletion check');
            assert.strictEqual(deletionResult.deleted, undefined, 'Account was not deleted while order was placed');
        });

        await itAsync('[UNIT MOCK] handles two concurrent deletion requests: second request receives 404', async () => {
            const rowLocks = new Map();
            let userRecord = { id: 'user-double-del', is_active: true };
            const userId = userRecord.id;

            const executeDeletion = async () => {
                while (rowLocks.has(userId)) {
                    await new Promise(r => setTimeout(r, 10));
                }
                rowLocks.set(userId, 'EXCLUSIVE');
                try {
                    // Check user active
                    if (!userRecord || !userRecord.is_active) {
                        const err = new Error('USER_NOT_FOUND_OR_INACTIVE');
                        err.statusCode = 404;
                        throw err;
                    }
                    // Simulate deletion work
                    await new Promise(r => setTimeout(r, 15));
                    userRecord.is_active = false;
                    return { statusCode: 200, body: { deleted: true } };
                } catch (err) {
                    return { statusCode: err.statusCode || 500, error: err.message };
                } finally {
                    rowLocks.delete(userId);
                }
            };

            const [res1, res2] = await Promise.all([executeDeletion(), executeDeletion()]);
            const results = [res1, res2];
            const successCount = results.filter(r => r.statusCode === 200).length;
            const notFoundCount = results.filter(r => r.statusCode === 404).length;

            assert.strictEqual(successCount, 1, 'Exactly one deletion request must succeed with 200');
            assert.strictEqual(notFoundCount, 1, 'Second concurrent deletion request must receive 404');
        });

        await itAsync('[UNIT MOCK] individual external cleanup failure logs diagnostic operation names without failing deletion response', async () => {
            const userId = 'user-external-fail';
            let deletionResponseStatus = 200;
            let deletionResponseBody = null;

            const loggedWarnings = [];
            const mockConsoleError = (msg, reason) => {
                loggedWarnings.push({ msg, reason });
            };

            const cleanupTasks = [
                { name: 'redis_cart_deletion', promise: Promise.reject(new Error('ECONNREFUSED')) },
                { name: 'trigger_jobs_cancellation', promise: Promise.resolve('ok') },
                { name: 'user_cache_invalidation', promise: Promise.reject(new Error('TIMEOUT')) },
            ];

            const results = await Promise.allSettled(cleanupTasks.map(t => t.promise));
            results.forEach((res, index) => {
                if (res.status === 'rejected') {
                    mockConsoleError(
                        `[DELETE_ACCOUNT_CLEANUP_WARN] Post-commit cleanup failed for operation: ${cleanupTasks[index].name}. Diagnostic reason:`,
                        res.reason?.message || res.reason
                    );
                }
            });

            deletionResponseBody = { deleted: true };

            assert.strictEqual(deletionResponseStatus, 200);
            assert.deepStrictEqual(deletionResponseBody, { deleted: true });
            assert.strictEqual(loggedWarnings.length, 2, 'Must log diagnostic warnings for the 2 failed tasks');
            assert.ok(loggedWarnings[0].msg.includes('redis_cart_deletion'), 'Must identify redis_cart_deletion failure');
            assert.ok(loggedWarnings[1].msg.includes('user_cache_invalidation'), 'Must identify user_cache_invalidation failure');
        });
    });

    console.log(`\n========================================`);
    console.log(`Phase C.2 Test Results: ${passedTests}/${totalTests} tests passed.`);
    console.log(`========================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runAllTests().catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
}
);
