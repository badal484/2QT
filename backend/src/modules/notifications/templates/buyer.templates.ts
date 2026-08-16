export interface TemplateParams {
    displayId?: string;
    orderId?: string;
    riderName?: string;
    otp?: string;
    minutes?: string;
    amount?: string;
    [key: string]: any;
}

export class BuyerTemplates {
    static format(type: string, params: TemplateParams = {}): { title: string; body: string; appType: 'buyer' } {
        const displayId = params.displayId || 'Order';
        const minutes = params.minutes || '30';
        const riderName = params.riderName || 'Rider';
        const otp = params.otp || '';

        switch (type) {
            case 'order_confirmed':
                return {
                    title: 'Order Confirmed! 🎉',
                    body: `Your order #${displayId} is confirmed — ~${minutes} mins.`,
                    appType: 'buyer',
                };

            case 'order_preparing':
                return {
                    title: 'Chefs are cooking! 👨‍🍳',
                    body: `Your meal for order #${displayId} is being freshly prepared right now.`,
                    appType: 'buyer',
                };

            case 'order_ready':
            case 'order_packing':
                return {
                    title: 'Order Ready! 🛵',
                    body: `Your order #${displayId} is packed and a rider is on the way.`,
                    appType: 'buyer',
                };

            case 'order_out_for_delivery':
                return {
                    title: `${riderName} is heading to you! 🛵`,
                    body: `Your rider is on the way. ${otp ? `OTP: ${otp} — share only at door.` : ''}`,
                    appType: 'buyer',
                };

            case 'order_delivered':
                return {
                    title: 'Delivered! 🎉',
                    body: `Your order #${displayId} has been delivered. Hope you enjoy your meal!`,
                    appType: 'buyer',
                };

            case 'order_cancelled':
                return {
                    title: 'Order Cancelled ⚠️',
                    body: `Order #${displayId} was cancelled. ${params.amount ? `₹${params.amount} refunded.` : ''}`,
                    appType: 'buyer',
                };

            default:
                return {
                    title: params.title || '2QT Update',
                    body: params.body || params.message || 'You have a new update.',
                    appType: 'buyer',
                };
        }
    }
}
