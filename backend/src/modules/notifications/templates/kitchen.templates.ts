import { TemplateParams } from './buyer.templates';

export class KitchenTemplates {
    static format(type: string, params: TemplateParams = {}): { title: string; body: string; appType: 'kitchen' } {
        const displayId = params.displayId || 'Order';

        switch (type) {
            case 'new_order':
            case 'kitchen_new_order':
                return {
                    title: '🔔 NEW ORDER RECEIVED!',
                    body: `New Order #${displayId} placed! Tap to accept and start preparation.`,
                    appType: 'kitchen',
                };

            case 'order_cancelled':
                return {
                    title: '🚨 ORDER CANCELLED!',
                    body: `Order #${displayId} has been cancelled. Stop kitchen preparation.`,
                    appType: 'kitchen',
                };

            case 'kitchen_payout':
                return {
                    title: '💰 Kitchen Settlement Complete',
                    body: `Today's settlement of ₹${params.amount || '0'} has been processed.`,
                    appType: 'kitchen',
                };

            default:
                return {
                    title: params.title || '👨‍🍳 Kitchen Alert',
                    body: params.body || params.message || 'New kitchen notification received.',
                    appType: 'kitchen',
                };
        }
    }
}
