import { query } from '../db';
import { VELTO } from '../config/constants';

export interface CartItem {
    menuItemId: string;
    quantity: number;
}

export const calculatePricing = async ({
    cartItems,
    addressId,
    promoCode,
    walletAmountPaise = 0,
    useLoyalty = false,
    isSubscriptionOrder = false,
    customerId
}: {
    cartItems: CartItem[];
    addressId: string;
    promoCode?: string;
    walletAmountPaise?: number;
    useLoyalty?: boolean;
    isSubscriptionOrder?: boolean;
    customerId: string;
}) => {
    // 1. Fetch item prices
    const itemIds = cartItems.map(i => i.menuItemId);
    const { rows: items } = await query(
        'SELECT id, price_paise, available, daily_limit, today_sold_count FROM menu_items WHERE id = ANY($1)',
        [itemIds]
    );

    const itemMap = new Map(items.map(i => [i.id, i]));

    let subtotalPaise = 0;
    for (const cartItem of cartItems) {
        const item = itemMap.get(cartItem.menuItemId);
        if (!item || !item.available || (item.today_sold_count + cartItem.quantity > item.daily_limit)) {
            throw new Error(`ITEM_UNAVAILABLE_${cartItem.menuItemId}`);
        }
        subtotalPaise += item.price_paise * cartItem.quantity;
    }

    let subscriptionDiscountPaise = 0;
    if (isSubscriptionOrder) {
        const { rows: subRows } = await query(`
            SELECT id, current_day_credits, remaining_meals 
            FROM subscriptions 
            WHERE customer_id = $1 AND status = 'active' AND is_active = true 
            AND current_day_credits > 0 AND remaining_meals > 0
            LIMIT 1
        `, [customerId]);

        if (subRows.length === 0) {
            throw new Error('NO_ACTIVE_SUBSCRIPTION_OR_CREDITS');
        }

        const firstItem = itemMap.get(cartItems[0].menuItemId);
        if (firstItem) {
            subscriptionDiscountPaise = firstItem.price_paise;
        }
    }

    // 2. Promo code
    let discountPaise = 0;
    let promoCodeId: string | null = null;
    if (promoCode) {
        const { rows: promos } = await query(
            'SELECT * FROM promo_codes WHERE code = $1 AND is_active = true AND (expires_at IS NULL OR expires_at >= NOW())',
            [promoCode]
        );
        const promo = promos[0];
        if (promo) {
            promoCodeId = promo.id;
            if (promo.discount_type === 'percent') {
                discountPaise = Math.floor((subtotalPaise * promo.discount_percent) / 100);
            } else {
                discountPaise = promo.discount_value_paise;
            }
            if (promo.max_discount_paise) {
                discountPaise = Math.min(discountPaise, promo.max_discount_paise);
            }
        }
    }

    // 3. Loyalty
    let loyaltyDiscountPaise = 0;
    if (useLoyalty) {
        const { rows: loyaltyRes } = await query("SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -points END), 0) as total_points FROM loyalty_transactions WHERE customer_id = $1", [customerId]);
        const totalPoints = parseInt(loyaltyRes[0].total_points || '0');
        
        if (totalPoints > 0) {
            const pointValuePaise = VELTO.LOYALTY.DISCOUNT_PER_HUNDRED_POINTS_PAISE / VELTO.LOYALTY.POINTS_FOR_DISCOUNT;
            loyaltyDiscountPaise = Math.floor(totalPoints * pointValuePaise);
            
            // Apply max discount cap if defined
            const cap = Math.floor((subtotalPaise - subscriptionDiscountPaise - discountPaise) * (VELTO.LOYALTY.MAX_DISCOUNT_PERCENT / 100));
            loyaltyDiscountPaise = Math.min(loyaltyDiscountPaise, cap);
        }
    }

    // 4. Delivery Fee
    let deliveryFeePaise = isSubscriptionOrder ? VELTO.DELIVERY.SUBSCRIBER_FEE_PAISE : VELTO.DELIVERY.BASE_FEE_PAISE;

    // 5. Surge (Stub for now - needs zoneId)
    let surgePaise = 0;

    // 6. GST (5%)
    const taxableAmount = Math.max(0, subtotalPaise - subscriptionDiscountPaise - discountPaise - loyaltyDiscountPaise);
    const gstPaise = Math.round(taxableAmount * 0.05);
    const cgstPaise = Math.round(gstPaise / 2);
    const sgstPaise = gstPaise - cgstPaise;

    const totalAmountPaise = taxableAmount + deliveryFeePaise + surgePaise + gstPaise;

    // 7. Wallet
    const { rows: wallet } = await query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1', [customerId]);
    const availableWallet = wallet[0]?.balance_paise || 0;
    const finalWalletDeduction = Math.min(walletAmountPaise, availableWallet, totalAmountPaise);

    const gatewayAmountPaise = totalAmountPaise - finalWalletDeduction;

    return {
        subtotalPaise,
        deliveryFeePaise,
        discountPaise,
        subscriptionDiscountPaise,
        loyaltyDiscountPaise,
        walletDeductionPaise: finalWalletDeduction,
        surgePaise,
        cgstPaise,
        sgstPaise,
        totalAmountPaise,
        gatewayAmountPaise,
        promoCodeId
    };
};
