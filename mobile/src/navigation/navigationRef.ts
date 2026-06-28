import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigateTo(name: string, params?: Record<string, any>) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  }
}

// Maps FCM notification data → screen name + params
export function navigateFromNotification(data: Record<string, string>) {
  const { type, orderId, screen } = data;

  // Explicit screen override from payload (for trigger rules)
  if (screen) {
    const screenMap: Record<string, { name: string; params?: any }> = {
      Cart: { name: 'Cart' },
      Wallet: { name: 'Wallet' },
      MyPlans: { name: 'MyPlans' },
      Home: { name: 'Home' },
      OrderHistory: { name: 'OrderHistory' },
      RateOrder: { name: 'RateOrder', params: orderId ? { orderId } : undefined },
    };
    const target = screenMap[screen];
    if (target) { navigateTo(target.name, target.params); return; }
  }

  switch (type) {
    case 'order_confirmed':
    case 'order_preparing':
    case 'order_ready':
    case 'order_out_for_delivery':
    case 'order_delivered':
    case 'order_cancelled':
      if (orderId) navigateTo('OrderPlaced', { orderId });
      break;
    case 'rating_reminder':
      if (orderId) navigateTo('RateOrder', { orderId });
      else navigateTo('OrderHistory');
      break;
    case 'low_subscription_meals':
    case 'renewal_reminder':
    case 'subscription_expiring':
      navigateTo('MyPlans');
      break;
    case 'wallet_low':
      navigateTo('Wallet');
      break;
    case 'cart_abandoned':
      navigateTo('Cart');
      break;
    case 'birthday':
    case 'winback':
    case 'flash_sale':
    case 'happy_hour':
    case 'broadcast_message':
    default:
      navigateTo('Home');
      break;
  }
}
