import { DBStrategy } from '../modules/notifications/strategies/db.strategy';
import { SocketStrategy } from '../modules/notifications/strategies/socket.strategy';
import { FCMStrategy } from '../modules/notifications/strategies/fcm.strategy';
import { NotificationDispatcherService } from '../modules/notifications/services/notification-dispatcher.service';
import { DeviceTokenService } from '../modules/notifications/services/device-token.service';
import { BuyerTemplates } from '../modules/notifications/templates/buyer.templates';
import { RiderTemplates } from '../modules/notifications/templates/rider.templates';
import { KitchenTemplates } from '../modules/notifications/templates/kitchen.templates';

import { firebaseAdminMessaging } from '../config/firebaseAdmin';

const { query } = require('../db');
const { emitToUser, emitToKitchen, emitToRiders, emitToOrder } = require('../socket');


describe('Notification Strategy Engine & Templates (Phase 2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Templates Formatting', () => {
        it('should format buyer templates correctly', () => {
            const confirmed = BuyerTemplates.format('order_confirmed', { displayId: '9823', minutes: '20' });
            expect(confirmed.title).toContain('Order Confirmed!');
            expect(confirmed.body).toContain('#9823');
            expect(confirmed.appType).toBe('buyer');
        });

        it('should format rider templates correctly', () => {
            const riderNotif = RiderTemplates.format('new_available_mission', { displayId: '9823' });
            expect(riderNotif.title).toContain('New Delivery Assigned!');
            expect(riderNotif.appType).toBe('rider');
        });

        it('should format kitchen templates correctly', () => {
            const kitchenNotif = KitchenTemplates.format('new_order', { displayId: '9823' });
            expect(kitchenNotif.title).toContain('NEW ORDER RECEIVED!');
            expect(kitchenNotif.appType).toBe('kitchen');
        });
    });

    describe('DBStrategy', () => {
        const strategy = new DBStrategy();

        it('should handle db channels', () => {
            expect(strategy.canHandle({ userId: 'u1', type: 't1', title: 'h', body: 'b', channels: ['db'] })).toBe(true);
            expect(strategy.canHandle({ userId: 'u1', type: 't1', title: 'h', body: 'b', channels: ['sms'] })).toBe(false);
        });

        it('should insert notification into database and set notifId on payload', async () => {
            (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'notif-123' }] });

            const payload: any = { userId: 'user-1', type: 'order_confirmed', title: 'Confirmed', body: 'Order #1', data: { orderId: 'ord-1' } };
            const res = await strategy.send(payload);

            expect(res.success).toBe(true);
            expect(payload.notifId).toBe('notif-123');
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO notifications'),
                ['user-1', 'order_confirmed', 'Confirmed', 'Order #1', JSON.stringify({ orderId: 'ord-1' }), 'db', 'sent']
            );
        });
    });

    describe('SocketStrategy', () => {
        const strategy = new SocketStrategy();

        it('should emit socket events to user and target rooms', async () => {
            const payload = {
                userId: 'user-1',
                type: 'order_confirmed',
                title: 'Confirmed',
                body: 'Order #1',
                notifId: 'notif-123',
                data: { orderId: 'ord-100', kitchenId: 'k-1' },
                appType: 'kitchen' as const,
            };

            const res = await strategy.send(payload);

            expect(res.success).toBe(true);
            expect(emitToUser).toHaveBeenCalledWith('user-1', 'new_notification', expect.objectContaining({ notifId: 'notif-123' }));
            expect(emitToKitchen).toHaveBeenCalledWith('k-1', 'new_kitchen_notification', expect.any(Object));
            expect(emitToOrder).toHaveBeenCalledWith('ord-100', 'order_status_notification', expect.any(Object));
        });
    });

    describe('FCMStrategy & DeviceToken Cleanup', () => {
        const strategy = new FCMStrategy();

        it('should return 0 delivered if no active tokens exist for user', async () => {
            jest.spyOn(DeviceTokenService, 'getActiveTokensForUser').mockResolvedValueOnce([]);

            const res = await strategy.send({ userId: 'u-no-token', type: 'order_confirmed', title: 'Hi', body: 'Bye' });

            expect(res.success).toBe(true);
            expect(res.deliveredCount).toBe(0);
            expect(firebaseAdminMessaging.sendEachForMulticast).not.toHaveBeenCalled();
        });

        it('should send FCM multicast and clean up invalid tokens', async () => {
            jest.spyOn(DeviceTokenService, 'getActiveTokensForUser').mockResolvedValueOnce(['token-good', 'token-bad']);
            const markTokenSpy = jest.spyOn(DeviceTokenService, 'markTokenInvalid').mockResolvedValue();

            (firebaseAdminMessaging.sendEachForMulticast as jest.Mock).mockResolvedValueOnce({
                responses: [
                    { success: true, messageId: 'msg-1' },
                    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
                ],
            });

            const res = await strategy.send({
                userId: 'u-1',
                type: 'order_confirmed',
                title: 'Confirmed',
                body: 'Body',
                appType: 'buyer',
            });

            expect(res.success).toBe(true);
            expect(res.deliveredCount).toBe(1);
            expect(firebaseAdminMessaging.sendEachForMulticast).toHaveBeenCalledWith(
                expect.objectContaining({
                    tokens: ['token-good', 'token-bad'],
                })
            );
            expect(markTokenSpy).toHaveBeenCalledWith('token-bad');
        });
    });

    describe('NotificationDispatcherService', () => {
        it('should dispatch to DB, Socket, and FCM strategies', async () => {
            (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'notif-999' }] });
            jest.spyOn(DeviceTokenService, 'getActiveTokensForUser').mockResolvedValueOnce([]);

            const results = await NotificationDispatcherService.dispatch({
                userId: 'u-1',
                type: 'order_confirmed',
                title: 'Hello',
                body: 'World',
            });

            expect(results.db.success).toBe(true);
            expect(results.socket.success).toBe(true);
            expect(results.fcm.success).toBe(true);
        });
    });
});
