import { BroadcastService } from '../modules/notifications/broadcast/broadcast.service';
import { BroadcastController } from '../modules/notifications/broadcast/broadcast.controller';
import { query } from '../db';
import { redis } from '../redis';

// Mocks
jest.mock('../db', () => ({
    query: jest.fn(),
}));

jest.mock('../redis', () => ({
    redis: {
        get: jest.fn(),
        setEx: jest.fn(),
        set: jest.fn().mockResolvedValue('OK'),
    },
}));

jest.mock('../modules/notifications/services/notification-dispatcher.service', () => ({
    NotificationDispatcherService: {
        dispatch: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../jobs/queues', () => ({
    notificationsQueue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
}));

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const { notificationsQueue } = require('../jobs/queues');

describe('Admin Broadcast Engine (Phase 4)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('BroadcastController Authorization', () => {
        it('should block non-admin users with 403', async () => {
            const req: any = { user: { role: 'customer', userId: 'u1' }, body: {} };
            const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await BroadcastController.createBroadcast(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('FORBIDDEN') }));
        });

        it('should reject invalid payload with 400', async () => {
            const req: any = { user: { role: 'super_admin', userId: 'u1' }, body: { title: '' } };
            const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await BroadcastController.createBroadcast(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('BroadcastService Recipient Resolution & Batching', () => {
        it('should resolve buyers and enqueue batches of 50', async () => {
            // 1. mock broadcast_campaigns INSERT
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'camp-1', title: 'Weekend Sale', body: '50% off', target_type: 'buyers', status: 'PROCESSING' }],
            });

            // 2. mock user resolution (120 buyer user IDs)
            const mockUserIds = Array.from({ length: 120 }, (_, i) => ({ id: `buyer-${i}` }));
            mockQuery.mockResolvedValueOnce({ rows: mockUserIds });

            // 3. mock UPDATE total_recipients
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const campaign = await BroadcastService.createCampaign({
                title: 'Weekend Sale',
                body: '50% off',
                targetType: 'buyers',
                targetFilter: {},
            }, 'admin-1');

            expect(campaign.total_recipients).toBe(120);
            // 120 recipients split into batches of 50 => 3 jobs added to BullMQ
            expect(notificationsQueue.add).toHaveBeenCalledTimes(3);
            expect(notificationsQueue.add).toHaveBeenCalledWith(
                'broadcast_batch',
                expect.objectContaining({ campaignId: 'camp-1', userIdsBatch: expect.any(Array) })
            );
        });

        it('should handle empty audience gracefully and mark completed', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'camp-empty', title: 'Test', body: 'Body', target_type: 'riders', status: 'PROCESSING' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // 0 riders found
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE total_recipients
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE status COMPLETED

            const campaign = await BroadcastService.createCampaign({
                title: 'Test',
                body: 'Body',
                targetType: 'riders',
                targetFilter: {},
            }, 'admin-1');

            expect(campaign.total_recipients).toBe(0);
            expect(campaign.status).toBe('COMPLETED');
            expect(notificationsQueue.add).not.toHaveBeenCalled();
        });

        it('should resolve specific user IDs when targetType is users', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'camp-users', title: 'VIP', body: 'Special', target_type: 'users', status: 'PROCESSING' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1' }, { id: 'u2' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const campaign = await BroadcastService.createCampaign({
                title: 'VIP',
                body: 'Special',
                targetType: 'users',
                targetFilter: { userIds: ['u1', 'u2'] },
            }, 'admin-1');

            expect(campaign.total_recipients).toBe(2);
            expect(notificationsQueue.add).toHaveBeenCalledTimes(1);
        });

        it('should resolve kitchen staff for a specific kitchen', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'camp-ks', title: 'Staff Notice', body: 'Inspection', target_type: 'kitchen_staff', status: 'PROCESSING' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'chef-1' }, { id: 'packer-1' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const campaign = await BroadcastService.createCampaign({
                title: 'Staff Notice',
                body: 'Inspection',
                targetType: 'kitchen_staff',
                targetFilter: { kitchenId: 'kitchen-123', kitchenTargetGroup: 'staff' },
            }, 'admin-1');

            expect(campaign.total_recipients).toBe(2);
            expect(notificationsQueue.add).toHaveBeenCalledTimes(1);
        });

        it('should resolve customers for a specific kitchen', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'camp-kc', title: 'Kitchen Offer', body: '20% off', target_type: 'kitchen_customers', status: 'PROCESSING' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cust-1' }, { id: 'cust-2' }, { id: 'cust-3' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const campaign = await BroadcastService.createCampaign({
                title: 'Kitchen Offer',
                body: '20% off',
                targetType: 'kitchen_customers',
                targetFilter: { kitchenId: 'kitchen-123', kitchenTargetGroup: 'customers' },
            }, 'admin-1');

            expect(campaign.total_recipients).toBe(3);
            expect(notificationsQueue.add).toHaveBeenCalledTimes(1);
        });
    });
});

