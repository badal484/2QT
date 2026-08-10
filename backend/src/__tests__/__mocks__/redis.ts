export const redis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  isOpen: true,
};

export const redisPub = { ...redis };
export const redisSub = { ...redis };
export const connectRedis = jest.fn().mockResolvedValue(undefined);

export const keys = {
  pendingOtp: (phone: string) => `otp:${phone}`,
  otpAttempts: (phone: string) => `otp_attempts:${phone}`,
  pendingPayment: (id: string) => `pending:${id}`,
  pendingOrder: (id: string) => `order:${id}`,
  processedWebhook: (id: string) => `webhook:${id}`,
  revokedToken: (jti: string) => `revoked:${jti}`,
  menu: (zoneId: string) => `menu:${zoneId}`,
  dedup: (key: string) => `dedup:${key}`,
  notifTemplate: (type: string) => `notif_template:${type}`,
  userMeta: (userId: string) => `user_meta:${userId}`,
  socket: (userId: string) => `socket:${userId}`,
  customerCart: (customerId: string) => `cart:${customerId}`,
  riderLocation: (riderId: string) => `rider_loc:${riderId}`,
  cfPayoutToken: () => 'cf_payout_token',
  deliveryOtpAttempts: (orderId: string) => `otp_fail:${orderId}`,
  walletTopup: (cfOrderId: string) => `wallet_topup:${cfOrderId}`,
  orderByCf: (cfOrderId: string) => `order_by_cf:${cfOrderId}`,
  activeRidersInZone: (zoneId: string) => `active_riders:${zoneId}`,
  activePromos: () => 'offers:promos',
  activeCampaigns: () => 'offers:campaigns',
};

export default redis;
