import { TemplateParams } from './buyer.templates';

export class RiderTemplates {
    static format(type: string, params: TemplateParams = {}): { title: string; body: string; appType: 'rider' } {
        const displayId = params.displayId || 'Order';
        const amount = params.amount || '0';

        switch (type) {
            case 'new_available_mission':
            case 'order_auto_assigned':
            case 'rider_assigned':
                return {
                    title: '⚡ New Delivery Assigned!',
                    body: `Order #${displayId} assigned to you. Tap to view pickup location.`,
                    appType: 'rider',
                };

            case 'order_cancelled':
                return {
                    title: '🚨 Order Cancelled',
                    body: `Order #${displayId} was cancelled by customer/system. Do not pick up.`,
                    appType: 'rider',
                };

            case 'rider_payout':
            case 'rider_guarantee_payout':
                return {
                    title: '💰 Payout Deposited!',
                    body: `₹${amount} payout sent to your UPI. Great job today!`,
                    appType: 'rider',
                };

            default:
                return {
                    title: params.title || '🏍️ Rider Alert',
                    body: params.body || params.message || 'You have a new rider notification.',
                    appType: 'rider',
                };
        }
    }
}
