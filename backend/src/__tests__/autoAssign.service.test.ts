/**
 * Unit tests for the dispatch engine's fleet isolation (migration 152 / Phase 9).
 *
 * Covers: a 'dedicated_fleet' restaurant's orders are matched ONLY against that restaurant's own
 * riders (users.restaurant_id), never the shared zone pool; a 'dedicated_fleet' restaurant with no
 * available rider is never broadcast to the shared pool as a last resort (that would defeat the
 * isolation); and — as a regression guard — 'platform_fleet' orders (every existing restaurant,
 * unless explicitly promoted) still run the original zone-based dispatch unchanged.
 */

import { query } from '../db';
import { emitToAdmin, emitToKitchen, emitToRiders, emitToUser } from '../socket';

jest.mock('../services/notification.service', () => ({
    NotificationService: { send: jest.fn().mockResolvedValue(undefined) },
}));

import { autoAssignOrder } from '../services/autoAssign';

const mockQuery = query as jest.Mock;

const baseOrderRow = {
    id: 'order-1',
    display_id: '2QT-100001',
    zone_id: 'zone-1',
    kitchen_id: 'kitchen-1',
    payment_method: 'online',
    restaurant_id: 'rest-1',
    delivery_lat: null,
    delivery_lng: null,
    kitchen_lat: '12.9',
    kitchen_lng: '77.5',
};

beforeEach(() => {
    mockQuery.mockReset();
    (emitToAdmin as jest.Mock).mockReset();
    (emitToKitchen as jest.Mock).mockReset();
    (emitToRiders as jest.Mock).mockReset();
    (emitToUser as jest.Mock).mockReset();
});

describe('autoAssignOrder — dedicated_fleet isolation', () => {
    it("assigns only from the restaurant's own riders, never the shared zone pool", async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ ...baseOrderRow, delivery_model: 'dedicated_fleet' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'rider-own-1', current_lat: null, current_lng: null, active_orders: '0' }] })
            .mockResolvedValueOnce({ rowCount: 1, rows: [] });

        await autoAssignOrder('order-1');

        expect(mockQuery).toHaveBeenCalledTimes(3);
        // The rider-selection query must scope by restaurant_id, not zone_id.
        const riderQueryCall = mockQuery.mock.calls[1];
        expect(riderQueryCall[0]).toContain('u.restaurant_id = $1');
        expect(riderQueryCall[1]).toEqual(['rest-1']);

        expect(emitToUser).toHaveBeenCalledWith('rider-own-1', 'order_auto_assigned', expect.any(Object));
    });

    it('with no available own rider, alerts the tenant but never broadcasts to the shared pool', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ ...baseOrderRow, delivery_model: 'dedicated_fleet' }] })
            .mockResolvedValueOnce({ rows: [] }); // no riders for this restaurant

        await autoAssignOrder('order-1', 2); // attempt 2 — the tier that would normally broadcast

        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(emitToAdmin).toHaveBeenCalledWith('order_needs_manual_assignment', expect.any(Object));
        expect(emitToKitchen).toHaveBeenCalledWith('kitchen-1', 'order_needs_manual_assignment', expect.any(Object));
        expect(emitToRiders).not.toHaveBeenCalled();
    });
});

describe('autoAssignOrder — platform_fleet (default) regression guard', () => {
    it('still runs the original zone-then-platform-wide dispatch when unset (COALESCE default)', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ ...baseOrderRow, restaurant_id: null, delivery_model: 'platform_fleet' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'rider-shared-1', current_lat: null, current_lng: null, active_orders: '0' }] }) // zone query
            .mockResolvedValueOnce({ rowCount: 1, rows: [] });

        await autoAssignOrder('order-1');

        const zoneQueryCall = mockQuery.mock.calls[1];
        expect(zoneQueryCall[0]).toContain('u.zone_id = $1');
        expect(zoneQueryCall[1]).toEqual(['zone-1']);
        expect(emitToUser).toHaveBeenCalledWith('rider-shared-1', 'order_auto_assigned', expect.any(Object));
    });

    it('with no riders anywhere, still broadcasts to the shared zone pool as a last resort on attempt 2', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ ...baseOrderRow, restaurant_id: null, delivery_model: 'platform_fleet' }] })
            .mockResolvedValueOnce({ rows: [] }) // zone query — empty
            .mockResolvedValueOnce({ rows: [] }); // platform-wide fallback — empty

        await autoAssignOrder('order-1', 2);

        expect(emitToRiders).toHaveBeenCalledWith(
            'order_needs_rider',
            expect.objectContaining({ orderId: 'order-1' }),
            'zone-1'
        );
    });
});
