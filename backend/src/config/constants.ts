// VELTO Business Constants
export const VELTO = {
    DELIVERY: {
        BASE_FEE_PAISE: 2500, // Rs.25
        SUBSCRIBER_FEE_PAISE: 0, // Free for subscribers
        MAX_RADIUS_KM: 4,
    },
    ORDERS: {
        CANCEL_FULL_REFUND_SECONDS: 60,
        MAX_ITEMS_PER_ORDER: 20,
        DELIVERY_OTP_DIGITS: 6,
        DELIVERY_OTP_EXPIRY_SECONDS: 7200, // 2 hours
        DELIVERY_OTP_MAX_ATTEMPTS: 3,
        PAYMENT_EXPIRY_MINUTES: 15,
    },
    LOYALTY: {
        POINTS_PER_HUNDRED_PAISE: 1, // 1 point per Rs.1 spent
        POINTS_FOR_DISCOUNT: 100, // 100 points = ₹1 discount
        DISCOUNT_PER_HUNDRED_POINTS_PAISE: 100, // Rs.1 discount per 100 points
        MAX_DISCOUNT_PERCENT: 20, // loyalty discount cannot exceed 20% of order
        EXPIRY_DAYS: 180,
    },
    REFERRAL: {
        REFERRER_REWARD_PAISE: 10000, // ₹100
        REFERRED_REWARD_PAISE: 5000,  // ₹50
        MIN_FIRST_ORDER_PAISE: 20000, // ₹200
        FRAUD_THRESHOLD: 50,
    },
    SUBSCRIPTION: {
        CARRY_FORWARD_MAX_MEALS: 2,
        EARLY_RENEWAL_MIN_DAYS: 3,
        PLANS: [
            { id: 'sub_lunch_20', name: '20 Lunch Plan', meals: 20, pricePaise: 199900, type: 'lunch' },
            { id: 'sub_lunch_30', name: '30 Lunch Plan', meals: 30, pricePaise: 279900, type: 'lunch' },
            { id: 'sub_dinner_20', name: '20 Dinner Plan', meals: 20, pricePaise: 219900, type: 'dinner' },
            { id: 'sub_dinner_30', name: '30 Dinner Plan', meals: 30, pricePaise: 299900, type: 'dinner' }
        ]
    },
    RIDER: {
        GUARANTEE_MINIMUM_PAISE: 50000, // Rs.500
        GUARANTEE_MIN_ONLINE_HOURS: 8,
        BASE_EARNINGS_PER_DELIVERY_PAISE: 2000, // Rs.20
    },
    GST: {
        RATE_PERCENT: 5,
        CGST_PERCENT: 2.5,
        SGST_PERCENT: 2.5,
        HSN_CODE: '9963',
    }
};
