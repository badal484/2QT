import { withTransaction } from '../db';
import { generateKitchenPayout } from '../services/kitchen-payout.service';

const KITCHEN_ID = 'kitchen-uuid-1';
const PERIOD_START = '2026-01-05'; // Monday
const PERIOD_END = '2026-01-11';   // Sunday

// Matches the pattern already established in order.service.test.ts — withTransaction
// is a mocked jest.fn() (see __mocks__/db.ts); each test wires it to invoke the real
// callback against a fake client whose query() responses are queued in call order.
describe('generateKitchenPayout', () => {
  let clientMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    clientMock = { query: jest.fn() };
    (withTransaction as jest.Mock).mockImplementation(async (cb: any) => cb(clientMock));
  });

  // client.query call order inside the function: [0] advisory lock, [1] period stats,
  // [2] already-paid netting, [3] (conditional) INSERT ... RETURNING id
  function queueResponses(opts: {
    periodStats: { orders_count: string; gross_sales_paise: string; commission_paise: string; net_payout_paise: string };
    already?: { already_gross_paise: string; already_commission_paise: string; already_net_paise: string; already_orders_count: string };
    insertedId?: string | null; // null => simulate ON CONFLICT DO NOTHING losing the race
  }) {
    const already = opts.already ?? {
      already_gross_paise: '0', already_commission_paise: '0', already_net_paise: '0', already_orders_count: '0',
    };
    clientMock.query
      .mockResolvedValueOnce({ rows: [] })                    // advisory lock
      .mockResolvedValueOnce({ rows: [opts.periodStats] })     // period stats
      .mockResolvedValueOnce({ rows: [already] });             // already-paid netting
    if (opts.insertedId !== undefined) {
      clientMock.query.mockResolvedValueOnce({
        rows: opts.insertedId ? [{ id: opts.insertedId }] : [],
      });
    }
  }

  // 1. Normal weekly payout — no prior payouts of any kind for this period.
  it('creates a full payout when nothing has been paid for this period yet', async () => {
    queueResponses({
      periodStats: { orders_count: '20', gross_sales_paise: '500000', commission_paise: '75000', net_payout_paise: '425000' },
      insertedId: 'payout-1',
    });

    const result = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(result).toEqual({ created: true, payoutId: 'payout-1', netPayoutPaise: 425000 });
    // gross/commission/net all passed through unnetted since "already paid" was 0
    const insertCall = clientMock.query.mock.calls[3];
    expect(insertCall[1]).toEqual([KITCHEN_ID, PERIOD_START, PERIOD_END, 500000, 75000, 425000, 20]);
  });

  // 2. + 6. Kitchen fully covered by daily auto-payout all week — already-paid equals
  // the week's full revenue, so no weekly payout should be created at all.
  it('does not create a payout when a kitchen was already fully paid via daily auto-payout', async () => {
    queueResponses({
      periodStats: { orders_count: '20', gross_sales_paise: '500000', commission_paise: '75000', net_payout_paise: '425000' },
      already: { already_gross_paise: '500000', already_commission_paise: '75000', already_net_paise: '425000', already_orders_count: '20' },
    });

    const result = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(result).toEqual({ created: false, netPayoutPaise: 0, reason: 'already_covered' });
    // Only 3 queries ran — lock, stats, netting. No INSERT was ever attempted.
    expect(clientMock.query).toHaveBeenCalledTimes(3);
  });

  // 3. + 7. Mixed scenario — kitchen enabled auto-payout mid-week, so only part of the
  // week was already paid daily. The weekly job should create a payout for exactly the
  // remainder, using plain integer subtraction (no floating point, no prorating).
  it('creates a partial payout for exactly the unpaid remainder in a mixed daily+weekly week', async () => {
    queueResponses({
      periodStats: { orders_count: '20', gross_sales_paise: '500033', commission_paise: '75011', net_payout_paise: '425022' },
      already: { already_gross_paise: '300019', already_commission_paise: '45003', already_net_paise: '255016', already_orders_count: '12' },
      insertedId: 'payout-2',
    });

    const result = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(result).toEqual({ created: true, payoutId: 'payout-2', netPayoutPaise: 170006 }); // 425022 - 255016
    const insertCall = clientMock.query.mock.calls[3];
    const [, , , gross, commission, net, orders] = insertCall[1];
    expect(gross).toBe(200014);      // 500033 - 300019
    expect(commission).toBe(30008);  // 75011 - 45003
    expect(net).toBe(170006);        // 425022 - 255016
    expect(orders).toBe(8);          // 20 - 12
    // Integer identity preserved exactly — gross minus commission equals net on the row,
    // exactly as it does on every individual order (no prorating introduced).
    expect(gross - commission).toBe(net);
  });

  // 4. Repeated cron execution — calling the function again for the same period after a
  // payout already exists (simulating a second cron tick, or a second call after a prior
  // successful run) must not create a second payout for revenue already covered.
  it('is safe to call again for the same period after a payout was already created', async () => {
    // First call: nothing paid yet.
    queueResponses({
      periodStats: { orders_count: '5', gross_sales_paise: '100000', commission_paise: '15000', net_payout_paise: '85000' },
      insertedId: 'payout-3',
    });
    const first = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);
    expect(first.created).toBe(true);

    jest.clearAllMocks();
    (withTransaction as jest.Mock).mockImplementation(async (cb: any) => cb(clientMock));

    // Second call (e.g. the worker re-ran the cron): the DB now reflects the first
    // call's row as "already paid" for the identical period, so the same underlying
    // revenue nets to zero and no second payout is created.
    queueResponses({
      periodStats: { orders_count: '5', gross_sales_paise: '100000', commission_paise: '15000', net_payout_paise: '85000' },
      already: { already_gross_paise: '100000', already_commission_paise: '15000', already_net_paise: '85000', already_orders_count: '5' },
    });
    const second = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(second).toEqual({ created: false, netPayoutPaise: 0, reason: 'already_covered' });
  });

  // 5. Concurrent execution — this test proves the function acquires the per-kitchen
  // advisory lock as the FIRST statement inside its transaction, which is the mechanism
  // Postgres uses to serialize two concurrent calls for the same kitchen (e.g. the
  // weekly cron and a manual finance "generate" firing at the same moment). A mocked
  // client can't reproduce real lock contention between two processes — that was
  // verified separately against a real local Postgres instance (see implementation
  // report); this test guards that the code path exercising that mechanism doesn't
  // silently regress.
  it('acquires a per-kitchen advisory lock before reading any payout data', async () => {
    queueResponses({
      periodStats: { orders_count: '1', gross_sales_paise: '10000', commission_paise: '1500', net_payout_paise: '8500' },
      insertedId: 'payout-4',
    });

    await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    const [lockSql, lockParams] = clientMock.query.mock.calls[0];
    expect(lockSql).toMatch(/pg_advisory_xact_lock/);
    expect(lockParams).toEqual([KITCHEN_ID]);
    // The lock must be the very first query — before any read of orders/kitchen_payouts —
    // otherwise a second concurrent caller could read a stale snapshot before this one
    // acquires the lock.
    const statsSql = clientMock.query.mock.calls[1][0];
    expect(statsSql).toMatch(/FROM orders/);
  });

  // 8. Zero remaining amount — revenue exists but nets to exactly zero (not negative,
  // not undefined) after subtracting what's already paid. Must not create a payout and
  // must not throw on the boundary.
  it('does not create a payout when the netted remainder is exactly zero', async () => {
    queueResponses({
      periodStats: { orders_count: '3', gross_sales_paise: '30000', commission_paise: '4500', net_payout_paise: '25500' },
      already: { already_gross_paise: '30000', already_commission_paise: '4500', already_net_paise: '25500', already_orders_count: '3' },
    });

    const result = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(result.created).toBe(false);
    expect(result.netPayoutPaise).toBe(0);
  });

  // Below the ₹1 minimum floor but not zero — same "not created" outcome, different
  // reason (nothing was paid before; the raw amount itself is just too small).
  it('does not create a payout below the minimum floor, distinct from the already-covered case', async () => {
    queueResponses({
      periodStats: { orders_count: '1', gross_sales_paise: '90', commission_paise: '10', net_payout_paise: '80' },
    });

    const result = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(result).toEqual({ created: false, netPayoutPaise: 80, reason: 'below_minimum' });
  });

  // Defense in depth: even if the advisory lock somehow didn't fully serialize two
  // callers (e.g. a bug in a future refactor), the pre-existing UNIQUE index on
  // (kitchen_id, period_start, period_end) still stops a duplicate row for the exact
  // same period — ON CONFLICT DO NOTHING returns 0 rows, which must be treated as
  // "not created", never as a thrown error or a phantom success.
  it('treats a lost race against an identical-period insert as not-created, not an error', async () => {
    queueResponses({
      periodStats: { orders_count: '5', gross_sales_paise: '100000', commission_paise: '15000', net_payout_paise: '85000' },
      insertedId: null, // ON CONFLICT DO NOTHING — 0 rows returned
    });

    const result = await generateKitchenPayout(KITCHEN_ID, PERIOD_START, PERIOD_END);

    expect(result).toEqual({ created: false, netPayoutPaise: 85000, reason: 'already_covered' });
  });
});
