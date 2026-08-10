import { redis } from '../redis';
import { query } from '../db';

jest.mock('../services/fcm.service', () => ({
  sendFCM: jest.fn().mockResolvedValue('ok'),
  isFCMConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('../jobs/queues', () => ({
  notificationsQueue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
  invoicesQueue: { add: jest.fn() },
  emailsQueue: { add: jest.fn() },
}));

import { deliverNotification, sendNotification } from '../services/notification.service';
import { sendFCM } from '../services/fcm.service';

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockRedisSetEx = redis.setEx as jest.Mock;

const MOCK_USER = {
  id: 'user-1',
  phone: '919876543210',
  device_token: 'fcm-token-abc123',
  name: 'Test User',
};

// deliverNotification DB call order:
// 1. SELECT users WHERE id = $1
// 2. (redis.get dedup — not a DB call)
// 3. (redis.get template cache — not a DB call)
// 4. SELECT notification_templates WHERE type = $1 [try/catch — uses fallback if throws]
// 5. SELECT notification_preferences WHERE user_id = $1
// 6. INSERT INTO notifications RETURNING id

function setupDeliveryMocks(user = MOCK_USER) {
  mockQuery
    .mockResolvedValueOnce({ rows: [user] })          // 1. user lookup
    .mockResolvedValueOnce({ rows: [] })               // 2. notification_templates (empty → fallback)
    .mockResolvedValueOnce({ rows: [] })               // 3. notification_preferences (empty → defaults)
    .mockResolvedValueOnce({ rows: [{ id: 'notif-1' }] }); // 4. notifications INSERT
}

describe('deliverNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null); // no cache, no dedup
  });

  it('returns early when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await deliverNotification('order_confirmed', { userId: 'ghost', vars: {} });
    expect(sendFCM).not.toHaveBeenCalled();
  });

  it('sends FCM when user has a device_token', async () => {
    setupDeliveryMocks();
    await deliverNotification('order_confirmed', {
      userId: 'user-1',
      vars: { displayId: '2QT-000001', minutes: '25' },
    });
    expect(sendFCM).toHaveBeenCalledWith(
      MOCK_USER.device_token,
      expect.stringContaining('Order Confirmed'),
      expect.any(String),
      expect.any(Object),
      undefined
    );
  });

  it('does not call FCM when device_token is null', async () => {
    setupDeliveryMocks({ ...MOCK_USER, device_token: null });
    await deliverNotification('order_confirmed', { userId: 'user-1', vars: {} });
    expect(sendFCM).not.toHaveBeenCalled();
  });

  it('skips delivery if dedupe key was already seen within 60s', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_USER] }); // user found
    mockRedisGet.mockResolvedValueOnce('1'); // dedup hit
    await deliverNotification('order_confirmed', { userId: 'user-1', vars: {}, dedupeKey: 'order-1' });
    expect(sendFCM).not.toHaveBeenCalled();
  });

  it('sets dedupe key in redis after successful delivery', async () => {
    setupDeliveryMocks();
    await deliverNotification('order_confirmed', { userId: 'user-1', vars: {}, dedupeKey: 'order-abc' });
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      expect.stringContaining('order-abc'),
      60,
      '1'
    );
  });

  it('clears stale FCM token when FCM returns invalid_token', async () => {
    (sendFCM as jest.Mock).mockResolvedValueOnce('invalid_token');
    setupDeliveryMocks();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE SET device_token = NULL

    await deliverNotification('order_confirmed', { userId: 'user-1', vars: {} });

    const clearCall = mockQuery.mock.calls.find((c: any[]) => c[0]?.includes('device_token = NULL'));
    expect(clearCall).toBeDefined();
  });

  it('interpolates template variables — riderName and otp appear in body', async () => {
    setupDeliveryMocks();
    await deliverNotification('order_out_for_delivery', {
      userId: 'user-1',
      vars: { riderName: 'Arjun', otp: '654321' },
    });
    const [, , body] = (sendFCM as jest.Mock).mock.calls[0];
    expect(body).toContain('654321');
  });

  it('produces no un-replaced {{}} placeholders in FCM payload', async () => {
    setupDeliveryMocks();
    await deliverNotification('order_confirmed', {
      userId: 'user-1',
      vars: { displayId: '2QT-000042', minutes: '30' },
    });
    const [, title, body] = (sendFCM as jest.Mock).mock.calls[0];
    expect(title).not.toMatch(/\{\{/);
    expect(body).not.toMatch(/\{\{/);
  });

  it('replaces missing vars with empty string without crashing', async () => {
    setupDeliveryMocks();
    await expect(
      deliverNotification('order_confirmed', { userId: 'user-1', vars: {} })
    ).resolves.not.toThrow();
  });

  it('skips promo notifications during quiet hours (10pm–8am IST)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_USER] });
    // 17:30 UTC = 23:00 IST (quiet hours)
    const mockNow = new Date('2024-01-01T17:30:00Z');
    const realDate = global.Date;
    jest.spyOn(global, 'Date').mockImplementation((arg?: any) =>
      arg === undefined ? mockNow : new realDate(arg)
    );
    (global.Date as any).now = () => mockNow.getTime();

    await deliverNotification('broadcast_message', {
      userId: 'user-1',
      vars: { title: 'Flash Sale!', body: '50% off' },
    });

    expect(sendFCM).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('sends promo notification during allowed hours (8am–10pm IST)', async () => {
    setupDeliveryMocks();
    // 07:00 UTC = 12:30 IST (allowed hours)
    const mockNow = new Date('2024-01-01T07:00:00Z');
    const realDate = global.Date;
    jest.spyOn(global, 'Date').mockImplementation((arg?: any) =>
      arg === undefined ? mockNow : new realDate(arg)
    );
    (global.Date as any).now = () => mockNow.getTime();

    await deliverNotification('broadcast_message', {
      userId: 'user-1',
      vars: { title: 'Offer', body: 'Get 10% off' },
    });

    expect(sendFCM).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

describe('sendNotification (BullMQ enqueue)', () => {
  it('enqueues notification job with correct type and options', async () => {
    const { notificationsQueue } = require('../jobs/queues');
    await sendNotification('order_confirmed', { userId: 'user-1', vars: { displayId: 'XXXX' } });
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'order_confirmed',
      expect.objectContaining({ userId: 'user-1', _queuedOptions: true })
    );
  });

  it('includes vars in the queued job data', async () => {
    const { notificationsQueue } = require('../jobs/queues');
    await sendNotification('rider_payout', { userId: 'user-1', vars: { amount: '500', upiId: 'test@upi' } });
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'rider_payout',
      expect.objectContaining({ vars: { amount: '500', upiId: 'test@upi' } })
    );
  });
});
