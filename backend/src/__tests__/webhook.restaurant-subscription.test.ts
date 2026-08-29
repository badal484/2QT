/**
 * HTTP-layer tests for the Phase 8 restaurant-subscription branch of POST /webhooks/razorpay.
 *
 * Unlike webhook.test.ts (which only unit-tests the HMAC math in isolation), this exercises the
 * real webhooks.ts router end-to-end via supertest, replicating the exact rawBody-capturing
 * express.json() verify callback wired in src/index.ts — signature verification reads
 * (req as any).rawBody, so a test app without that middleware would silently and incorrectly
 * always fail signature checks.
 */

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { query } from '../db';

jest.mock('../services/referral.service', () => ({
  processReferral: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/order.service', () => ({
  finalizeOrder: jest.fn().mockResolvedValue({ status: 'confirmed' }),
  finalizeWalletRecharge: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/subscription.service', () => ({
  handleSubscriptionRenewal: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/notification.service', () => ({
  NotificationService: { send: jest.fn().mockResolvedValue(undefined) },
}));

import webhooksRouter from '../routes/webhooks';

const WEBHOOK_SECRET = 'test_webhook_secret_phase8';

const app = express();
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use('/webhooks', webhooksRouter);

const mockQuery = query as jest.Mock;

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

function orderPaidPayload(notes: Record<string, any>, opts: { rzpOrderId?: string; rzpPaymentId?: string } = {}) {
  return {
    event: 'order.paid',
    payload: {
      order: { entity: { id: opts.rzpOrderId ?? 'order_rsub_1', notes } },
      payment: { entity: { id: opts.rzpPaymentId ?? 'pay_rsub_1', method: 'card' } },
    },
  };
}

async function postWebhook(body: any) {
  const rawBody = JSON.stringify(body);
  return request(app)
    .post('/webhooks/razorpay')
    .set('x-razorpay-signature', sign(rawBody))
    .set('Content-Type', 'application/json')
    .send(rawBody);
}

describe('POST /webhooks/razorpay — restaurant_subscription (Phase 8)', () => {
  const ORIGINAL_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });
  afterAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('activates a pending subscription when a real signed order.paid event arrives, resolved by razorpay_order_id (not by trusting notes.restaurantId)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'sub-1', restaurant_id: 'restaurant-A' }],
    });

    const res = await postWebhook(
      orderPaidPayload({ type: 'restaurant_subscription', restaurantId: 'restaurant-A' }, { rzpOrderId: 'order_rsub_1', rzpPaymentId: 'pay_rsub_1' })
    );

    expect(res.status).toBe(200);
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain("SET status = 'active'");
    expect(call[0]).toContain("WHERE razorpay_order_id = $1 AND status = 'pending'");
    expect(call[1]).toEqual(['order_rsub_1', 'pay_rsub_1']);
  });

  it('is idempotent: a redelivered webhook for an already-active subscription updates zero rows and still returns 200', async () => {
    // The route's WHERE ... AND status = 'pending' guard is what makes this safe — simulated
    // here by the mock returning no rows, exactly as the real UPDATE would on a second delivery.
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await postWebhook(
      orderPaidPayload({ type: 'restaurant_subscription', restaurantId: 'restaurant-A' }, { rzpOrderId: 'order_rsub_1' })
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(mockQuery).toHaveBeenCalledTimes(1); // no second write path taken
  });

  it('rejects a request with an invalid signature — never touches the database', async () => {
    const body = orderPaidPayload({ type: 'restaurant_subscription', restaurantId: 'restaurant-A' });
    const rawBody = JSON.stringify(body);
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', 'deadbeef'.repeat(8))
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(res.status).toBe(400);
    expect(res.text).toBe('Invalid Signature');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects a tampered payload even with a signature that was valid for the original body', async () => {
    const original = orderPaidPayload({ type: 'restaurant_subscription', restaurantId: 'restaurant-A' });
    const validSig = sign(JSON.stringify(original));
    const tampered = orderPaidPayload({ type: 'restaurant_subscription', restaurantId: 'restaurant-EVIL' });

    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', validSig)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(tampered));

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('a forged notes.restaurantId cannot activate a subscription it does not have a matching razorpay_order_id for — the DB lookup is what matters, not the notes payload', async () => {
    // Even though notes claims restaurant-VICTIM, the UPDATE is keyed purely off
    // razorpay_order_id, and if no pending row exists for that exact order id, nothing changes.
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await postWebhook(
      orderPaidPayload({ type: 'restaurant_subscription', restaurantId: 'restaurant-VICTIM' }, { rzpOrderId: 'order_never_created' })
    );

    expect(res.status).toBe(200);
    const call = mockQuery.mock.calls[0];
    expect(call[1][0]).toBe('order_never_created'); // lookup key is the gateway order id, never the notes restaurantId
  });
});
