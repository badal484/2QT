import { query } from '../db';
import { TWO_QT } from '../config/constants';

export interface CartItem {
    menuItemId: string;
    quantity: number;
    customizations?: { group: string; option: string }[];
}

export const calculatePricing = async ({
    cartItems,
    promoCode,
    walletAmountPaise = 0,
    useLoyalty = false,
    isSubscriptionOrder = false,
    customerId,
    riderTipPaise = 0,
    zoneId,
    distanceKm
}: {
    cartItems: CartItem[];
    addressId?: string;
    promoCode?: string;
    walletAmountPaise?: number;
    useLoyalty?: boolean;
    isSubscriptionOrder?: boolean;
    customerId: string;
    riderTipPaise?: number;
    zoneId: string;
    distanceKm: number;
}) => {
    // ── 1. Fetch item prices ────────────────────────────────────────────────────
    const itemIds = cartItems.map(i => i.menuItemId);
    const { rows: items } = await query(
        'SELECT id, price_paise, available, daily_limit, today_sold_count, customization_groups, kitchen_id, category FROM menu_items WHERE id = ANY($1)',
        [itemIds]
    );

    const itemMap = new Map(items.map(i => [i.id, i]));

    // ── 2. Fetch active menu offers for this zone ───────────────────────────────
    const { rows: menuOffers } = await query(
        `SELECT * FROM menu_offers
         WHERE is_active = true
         AND (zone_id IS NULL OR zone_id = $1)
         AND (start_time IS NULL OR start_time <= NOW())
         AND (end_time IS NULL OR end_time >= NOW())`,
        [zoneId]
    );

    // ── 3. Subtotal + per-item offer discount ───────────────────────────────────
    let subtotalPaise = 0;
    let menuOfferDiscountPaise = 0;

    for (const cartItem of cartItems) {
        const item = itemMap.get(cartItem.menuItemId);
        if (!item || !item.available || (item.today_sold_count + cartItem.quantity > item.daily_limit)) {
            throw new Error(`ITEM_UNAVAILABLE_${cartItem.menuItemId}`);
        }

        let itemPrice = item.price_paise;
        if (cartItem.customizations && cartItem.customizations.length > 0 && item.customization_groups) {
            cartItem.customizations.forEach((c: any) => {
                const group = item.customization_groups.find((g: any) => g.name === c.group);
                if (group) {
                    const opt = group.options.find((o: any) => o.name === c.option);
                    if (opt && opt.price_paise) itemPrice += opt.price_paise;
                }
            });
        }

        // Find best offer discount for this item
        let bestOfferDiscount = 0;
        for (const offer of menuOffers) {
            const matches =
                offer.target_type === 'all' ||
                (offer.target_type === 'item'     && offer.target_id === item.id) ||
                (offer.target_type === 'category' && String(offer.target_id) === String(item.category)) ||
                (offer.target_type === 'kitchen'  && offer.target_id === item.kitchen_id);

            if (!matches) continue;

            // Audience check
            if (offer.audience === 'plus_subscribers') {
                const { rows: plusRows } = await query(
                    `SELECT 1 FROM plus_subscriptions
                     WHERE customer_id = $1 AND status = 'active' AND expires_at > NOW() LIMIT 1`,
                    [customerId]
                );
                if (plusRows.length === 0) continue;
            }
            if (offer.audience === 'new_users') {
                const { rows: orderRows } = await query(
                    `SELECT 1 FROM orders WHERE customer_id = $1 AND status = 'delivered' LIMIT 1`,
                    [customerId]
                );
                if (orderRows.length > 0) continue;
            }

            let discount = 0;
            if (offer.discount_type === 'flat') {
                discount = offer.discount_flat_paise || 0;
            } else {
                discount = Math.floor((itemPrice * (offer.discount_percent || 0)) / 100);
                if (offer.max_discount_paise) discount = Math.min(discount, offer.max_discount_paise);
            }
            // Cap: discount cannot exceed item price
            discount = Math.min(discount, itemPrice);
            if (discount > bestOfferDiscount) bestOfferDiscount = discount;
        }

        subtotalPaise += itemPrice * cartItem.quantity;
        menuOfferDiscountPaise += bestOfferDiscount * cartItem.quantity;
    }

    // ── 4. Minimum order check ─────────────────────────────────────────────────
    const { rows: zoneRows } = await query(`
        SELECT delivery_fee_type, base_delivery_fee_paise, per_km_fee_paise,
               base_distance_km, free_delivery_above_paise, surge_multiplier,
               min_order_paise, small_order_fee_paise
        FROM zones WHERE id = $1
    `, [zoneId]);

    const zone = zoneRows[0];
    const minOrderPaise = zone?.min_order_paise || 0;

    // Effective subtotal after menu offers (used for min order and tier checks)
    const effectiveSubtotal = Math.max(0, subtotalPaise - menuOfferDiscountPaise);

    if (minOrderPaise > 0 && effectiveSubtotal < minOrderPaise && !isSubscriptionOrder) {
        throw new Error(`MIN_ORDER_NOT_MET:${minOrderPaise}`);
    }

    // ── 5. Subscription discount ────────────────────────────────────────────────
    let subscriptionDiscountPaise = 0;
    if (isSubscriptionOrder) {
        const { rows: subRows } = await query(`
            SELECT id FROM subscriptions
            WHERE customer_id = $1 AND status = 'active' AND is_active = true
            AND current_day_credits > 0 AND remaining_meals > 0
            LIMIT 1
        `, [customerId]);
        if (subRows.length === 0) throw new Error('NO_ACTIVE_SUBSCRIPTION_OR_CREDITS');
        const firstItem = itemMap.get(cartItems[0].menuItemId);
        if (firstItem) subscriptionDiscountPaise = firstItem.price_paise;
    }

    // ── 6. Promo code ──────────────────────────────────────────────────────────
    let discountPaise = 0;
    let promoCodeId: string | null = null;
    if (promoCode) {
        const { rows: promos } = await query(
            `SELECT * FROM promo_codes
             WHERE code = $1
             AND is_active = true
             AND (expires_at IS NULL OR expires_at >= NOW())
             AND (max_uses IS NULL OR times_used < max_uses)
             AND (zone_id IS NULL OR zone_id = $2)`,
            [promoCode, zoneId]
        );
        const promo = promos[0];
        if (!promo) throw new Error('PROMO_INVALID_OR_EXPIRED');

        // Check min order requirement
        if (promo.min_order_paise > 0 && effectiveSubtotal < promo.min_order_paise) {
            throw new Error(`PROMO_MIN_ORDER:${promo.min_order_paise}`);
        }

        // Check first_order_only
        if (promo.first_order_only) {
            const { rows: prevOrders } = await query(
                `SELECT 1 FROM orders WHERE customer_id = $1 AND status = 'delivered' LIMIT 1`,
                [customerId]
            );
            if (prevOrders.length > 0) throw new Error('PROMO_FIRST_ORDER_ONLY');
        }

        // Check new_user_only
        if (promo.new_user_only) {
            const { rows: prevOrders } = await query(
                `SELECT 1 FROM orders WHERE customer_id = $1 LIMIT 1`,
                [customerId]
            );
            if (prevOrders.length > 0) throw new Error('PROMO_NEW_USER_ONLY');
        }

        // Check per_user_limit
        if (promo.per_user_limit != null) {
            const { rows: usageRows } = await query(
                `SELECT COUNT(*) as cnt FROM customer_promo_uses
                 WHERE customer_id = $1 AND promo_code_id = $2`,
                [customerId, promo.id]
            );
            if (parseInt(usageRows[0].cnt) >= promo.per_user_limit) {
                throw new Error('PROMO_USAGE_LIMIT_REACHED');
            }
        }

        promoCodeId = promo.id;
        if (promo.discount_type === 'percent') {
            discountPaise = Math.floor((effectiveSubtotal * promo.discount_percent) / 100);
        } else {
            discountPaise = promo.discount_value_paise || promo.discount_flat_paise || 0;
        }
        if (promo.max_discount_paise) {
            discountPaise = Math.min(discountPaise, promo.max_discount_paise);
        }
    }

    // ── 7. Campaign discounts (flash sale / happy hour / winback) ─────────────
    let campaignDiscountPaise = 0;
    let campaignFreeDelivery = false;

    {
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const nowTs = new Date();
        const todayDay = dayNames[nowTs.getDay()];
        const timeNow = `${nowTs.getHours().toString().padStart(2, '0')}:${nowTs.getMinutes().toString().padStart(2, '0')}`;

        const { rows: campaigns } = await query(
            `SELECT id, type, discount_type, discount_percent, discount_flat_paise,
                    max_discount_paise, min_order_paise, winback_days, audience_type
             FROM campaigns
             WHERE is_active = true
             AND (zone_id IS NULL OR zone_id = $1)
             AND (
                 (type = 'flash_sale' AND flash_start <= NOW() AND flash_end >= NOW())
                 OR (type = 'happy_hour'
                     AND happy_hour_start::time <= $2::time
                     AND happy_hour_end::time >= $2::time
                     AND $3 = ANY(happy_hour_days))
                 OR (type NOT IN ('flash_sale', 'happy_hour'))
             )`,
            [zoneId, timeNow, todayDay]
        );

        for (const campaign of campaigns) {
            if (campaign.min_order_paise > 0 && effectiveSubtotal < campaign.min_order_paise) continue;

            if (campaign.type === 'winback') {
                const { rows: recentOrders } = await query(
                    `SELECT 1 FROM orders WHERE customer_id = $1 AND status = 'delivered'
                     AND created_at > NOW() - ($2 * INTERVAL '1 day') LIMIT 1`,
                    [customerId, campaign.winback_days || 7]
                );
                if (recentOrders.length > 0) continue;
            }

            if (campaign.discount_type === 'free_delivery') {
                campaignFreeDelivery = true;
                continue;
            }

            let disc = 0;
            if (campaign.discount_type === 'flat') {
                disc = campaign.discount_flat_paise || 0;
            } else {
                // covers 'percentage' and any other value
                disc = Math.floor((effectiveSubtotal * parseFloat(campaign.discount_percent || '0')) / 100);
                if (campaign.max_discount_paise) disc = Math.min(disc, campaign.max_discount_paise);
            }
            if (disc > campaignDiscountPaise) campaignDiscountPaise = disc;
        }
    }

    // ── 8. Loyalty points ──────────────────────────────────────────────────────
    let loyaltyDiscountPaise = 0;
    if (useLoyalty) {
        const { rows: loyaltyRes } = await query(
            `SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -points END), 0) as total_points
             FROM loyalty_transactions
             WHERE customer_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
            [customerId]
        );
        const totalPoints = parseInt(loyaltyRes[0].total_points || '0');
        if (totalPoints > 0) {
            const pointValuePaise = TWO_QT.LOYALTY.DISCOUNT_PER_HUNDRED_POINTS_PAISE / TWO_QT.LOYALTY.POINTS_FOR_DISCOUNT;
            loyaltyDiscountPaise = Math.floor(totalPoints * pointValuePaise);
            const afterPromo = Math.max(0, effectiveSubtotal - subscriptionDiscountPaise - discountPaise);
            const cap = Math.floor(afterPromo * (TWO_QT.LOYALTY.MAX_DISCOUNT_PERCENT / 100));
            loyaltyDiscountPaise = Math.min(loyaltyDiscountPaise, cap);
        }
    }

    // ── 8. Delivery fee — tiers first, then flat/per_km fallback ───────────────
    let deliveryFeePaise = isSubscriptionOrder
        ? TWO_QT.DELIVERY.SUBSCRIBER_FEE_PAISE
        : TWO_QT.DELIVERY.BASE_FEE_PAISE;
    let surgePaise = 0;
    let smallOrderFeePaise = 0;

    if (zone && !isSubscriptionOrder) {
        // Try delivery fee tiers first
        const { rows: tiers } = await query(
            `SELECT fee_paise FROM delivery_fee_tiers
             WHERE zone_id = $1
             AND from_paise <= $2
             AND (to_paise IS NULL OR to_paise > $2)
             ORDER BY from_paise DESC
             LIMIT 1`,
            [zoneId, effectiveSubtotal]
        );

        if (tiers.length > 0) {
            deliveryFeePaise = tiers[0].fee_paise;
        } else {
            // Fallback: flat or per_km
            if (zone.delivery_fee_type === 'per_km') {
                const extraKm = Math.max(0, distanceKm - parseFloat(zone.base_distance_km));
                deliveryFeePaise = zone.base_delivery_fee_paise + Math.ceil(extraKm) * zone.per_km_fee_paise;
            } else {
                deliveryFeePaise = zone.base_delivery_fee_paise;
            }

            // Free delivery threshold (only when no tier system)
            if (zone.free_delivery_above_paise != null && effectiveSubtotal >= zone.free_delivery_above_paise) {
                deliveryFeePaise = 0;
            }
        }

        // Campaign free-delivery override
        if (campaignFreeDelivery) deliveryFeePaise = 0;

        // Surge on top of whatever delivery fee was set
        if (zone.surge_multiplier && parseFloat(zone.surge_multiplier) > 1.0) {
            const withSurge = Math.floor(deliveryFeePaise * parseFloat(zone.surge_multiplier));
            surgePaise = withSurge - deliveryFeePaise;
        }

        // Small order fee: applies when below min_order (and we didn't block above)
        // Only relevant if min_order_paise = 0 (no hard block) but small_order_fee > 0
        if (zone.small_order_fee_paise > 0 && effectiveSubtotal < (zone.min_order_paise || 0)) {
            smallOrderFeePaise = zone.small_order_fee_paise;
        }
    }

    // ── 10. GST ────────────────────────────────────────────────────────────────
    const totalDiscount = menuOfferDiscountPaise + subscriptionDiscountPaise + discountPaise + loyaltyDiscountPaise + campaignDiscountPaise;
    const taxableAmount = Math.max(0, subtotalPaise - totalDiscount);
    const gstPaise  = Math.round(taxableAmount * (TWO_QT.GST.RATE_PERCENT / 100));
    const cgstPaise = Math.round(gstPaise / 2);
    const sgstPaise = gstPaise - cgstPaise;

    const totalAmountPaise =
        taxableAmount + deliveryFeePaise + surgePaise + smallOrderFeePaise + gstPaise + riderTipPaise;

    // ── 11. Wallet ─────────────────────────────────────────────────────────────
    const { rows: wallet } = await query(
        'SELECT balance_paise FROM customer_wallet WHERE customer_id = $1',
        [customerId]
    );
    const availableWallet = wallet[0]?.balance_paise || 0;
    const finalWalletDeduction = Math.min(walletAmountPaise, availableWallet, totalAmountPaise);
    const gatewayAmountPaise = totalAmountPaise - finalWalletDeduction;

    return {
        subtotalPaise,
        menuOfferDiscountPaise,
        campaignDiscountPaise,
        subscriptionDiscountPaise,
        discountPaise,
        loyaltyDiscountPaise,
        deliveryFeePaise,
        surgePaise,
        smallOrderFeePaise,
        cgstPaise,
        sgstPaise,
        totalAmountPaise,
        walletDeductionPaise: finalWalletDeduction,
        gatewayAmountPaise,
        promoCodeId,
        riderTipPaise,
    };
};
