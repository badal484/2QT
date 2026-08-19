export interface DeepLinkPayload {
    screen?: string;
    orderId?: string;
    ticketId?: string;
    type?: string;
    params?: string | Record<string, any>;
    deep_link?: string;
    [key: string]: any;
}

export class DeepLinkResolver {
    static resolve(payload: DeepLinkPayload, navigation: any) {
        if (!navigation || typeof navigation.navigate !== 'function') {
            console.warn('[DeepLinkResolver] Navigation reference unavailable');
            return;
        }

        try {
            let data = payload || {};
            if (typeof payload === 'string') {
                try { data = JSON.parse(payload); } catch {}
            }

            const parsedParams = typeof data.params === 'string' ? JSON.parse(data.params) : (data.params || {});
            const orderId = data.orderId || parsedParams.orderId;
            const ticketId = data.ticketId || parsedParams.ticketId;
            const type = data.type || '';

            // 1. Explicit Screen Routing
            if (data.screen) {
                navigation.navigate(data.screen, { orderId, ticketId, ...parsedParams });
                return;
            }

            // 2. Support Ticket Routing
            if (type.includes('support') || ticketId) {
                navigation.navigate('Support', { ticketId });
                return;
            }

            // 3. Order Status Routing
            if (orderId || type.includes('order')) {
                navigation.navigate('OrderConfirmed', { orderId });
                return;
            }

            // 4. Wallet Routing
            if (type.includes('wallet') || type.includes('payout')) {
                navigation.navigate('Wallet');
                return;
            }

            // 5. Rider Home / Mission Routing
            if (type.includes('rider') || type.includes('mission')) {
                navigation.navigate('RiderHome');
                return;
            }

            // Fallback: Default to Home
            navigation.navigate('Home');
        } catch (error) {
            console.error('[DeepLinkResolver] Failed resolving deep link:', error);
        }
    }

    // Alias overload for backward/forward call signature compatibility
    static handle(navigation: any, payload: DeepLinkPayload) {
        return DeepLinkResolver.resolve(payload, navigation);
    }
}
