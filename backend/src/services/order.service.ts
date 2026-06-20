import { withTransaction, query } from '../db';
import { redis, keys } from '../redis';
import { notificationsQueue } from '../jobs/queues';
import { emitToKitchen, emitToUser, emitToAdmin, emitToRiders } from '../socket';
import { processReferral } from '../services/referral.service';
import { TWO_QT } from '../config/constants';

const getDeliveryOtpForOrder = () => {
    if (process.env.NODE_ENV === 'development') {
        return process.env.TEST_DELIVERY_OTP || '654321';
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export async function createPendingOrder(data: any) {
    return await withTransaction(async (client) => {
        // Snapshot delivery coordinates from the address at placement time so
        // a later address update or migration never corrupts an in-flight order.
        const { rows: addrRows } = await client.query(
            'SELECT lat, lng FROM addresses WHERE id = $1', [data.addressId]
        );
        const deliveryLat = addrRows[0]?.lat ?? null;
        const deliveryLng = addrRows[0]?.lng ?? null;

        const { rows: orderRows } = await client.query(`
            INSERT INTO orders (
                display_id, customer_id, kitchen_id, zone_id, address_id, status,
                subtotal_paise, delivery_fee_paise, discount_paise,
                loyalty_discount_paise, wallet_deduction_paise, surge_paise,
                cgst_paise, sgst_paise, total_amount_paise, gateway_amount_paise,
                payment_method, payment_status, promo_code_id,
                is_subscription_order, special_instructions,
                delivery_location_lat, delivery_location_lng,
                delivery_contact_name, delivery_contact_phone
            ) VALUES ('2QT-' || LPAD(nextval('order_display_id_seq')::TEXT, 6, '0'), $1, $2, $3, $4, 'pending_payment', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', $16, $17, $18, $19, $20, $21, $22)
            RETURNING id, display_id
        `, [
            data.customerId, data.kitchenId, data.zoneId, data.addressId,
            data.pricing.subtotalPaise, data.pricing.deliveryFeePaise,
            data.pricing.discountPaise, data.pricing.loyaltyDiscountPaise,
            data.pricing.walletDeductionPaise, data.pricing.surgePaise,
            data.pricing.cgstPaise, data.pricing.sgstPaise,
            data.pricing.totalAmountPaise, data.pricing.gatewayAmountPaise,
            data.paymentMethod || 'online',
            data.pricing.promoCodeId ?? null,
            data.isSubscriptionOrder || false,
            data.instructions || null,
            deliveryLat, deliveryLng,
            data.deliveryContactName || null,
            data.deliveryContactPhone || null,
        ]);

        const newOrder = orderRows[0];

        for (const item of data.items) {
            await client.query(`
                INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, price_paise, station)
                SELECT $1, id, name, $2, price_paise, station FROM menu_items WHERE id = $3
            `, [newOrder.id, item.quantity, item.menuItemId]);
        }

        return newOrder;
    });
}

export async function finalizeOrder(gatewayOrderId: string, paymentMethod: string, internalOrderId?: string) {
    const processed = await redis.get(keys.processedWebhook(gatewayOrderId));
    if (processed) return { status: 'already_processed' };

    try {
        const result = await withTransaction(async (client) => {
            // 1. Find the order
            let order;
            if (internalOrderId) {
                const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [internalOrderId]);
                order = rows[0];
            } else {
                const { rows } = await client.query('SELECT * FROM orders WHERE gateway_order_id = $1 FOR UPDATE', [gatewayOrderId]);
                order = rows[0];
            }

            if (!order) throw new Error('ORDER_NOT_FOUND');
            if (order.status !== 'pending_payment') return { status: 'already_finalized', orderId: order.id };

            // 2. Re-verify wallet if used
            let walletRows: { balance_paise: number }[] = [];
            if (order.wallet_deduction_paise > 0) {
                const { rows } = await client.query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1 FOR UPDATE', [order.customer_id]);
                walletRows = rows;
                if ((walletRows[0]?.balance_paise || 0) < order.wallet_deduction_paise) {
                    throw new Error('INSUFFICIENT_WALLET_BALANCE_AT_FINALIZATION');
                }
            }

            // 3. Update Order Status
            const otp = getDeliveryOtpForOrder();
            const { rows: updatedRows } = await client.query(`
                UPDATE orders SET 
                    status = 'confirmed', 
                    payment_status = 'paid',
                    payment_method = $1,
                    gateway_order_id = $2,
                    delivery_otp = $3,
                    delivery_otp_expires_at = NOW() + interval '2 hours'
                WHERE id = $4
                RETURNING id, display_id, customer_id, kitchen_id, zone_id, total_amount_paise, gateway_amount_paise
            `, [paymentMethod, gatewayOrderId, otp, order.id]);

            const finalizedOrder = updatedRows[0];

            // 3.5 Calculate and store commission for partner kitchens
            const { rows: kitchenRows } = await client.query(
                'SELECT is_partner, commission_rate FROM kitchens WHERE id = $1',
                [order.kitchen_id]
            );
            const kitchen = kitchenRows[0];
            if (kitchen?.is_partner && parseFloat(kitchen.commission_rate) > 0) {
                const subtotalPaise = order.subtotal_paise || 0;
                const deliveryFeePaise = order.delivery_fee_paise || 0;
                const commissionRate = parseFloat(kitchen.commission_rate);
                const commissionPaise = Math.round(subtotalPaise * commissionRate);
                const kitchenPayoutPaise = subtotalPaise - commissionPaise;
                const platformDeliveryPaise = Math.round(deliveryFeePaise * 0.25);
                await client.query(`
                    UPDATE orders SET
                        commission_rate = $1,
                        commission_paise = $2,
                        kitchen_payout_paise = $3,
                        platform_delivery_paise = $4
                    WHERE id = $5
                `, [commissionRate, commissionPaise, kitchenPayoutPaise, platformDeliveryPaise, order.id]);
            }

            // 4. Update Inventory & Item stats
            const { rows: items } = await client.query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1', [order.id]);
            for (const item of items) {
                await client.query(`
                    UPDATE menu_items SET 
                        today_sold_count = today_sold_count + $1,
                        available = CASE WHEN today_sold_count + $1 >= daily_limit THEN false ELSE available END,
                        sold_out_reason = CASE WHEN today_sold_count + $1 >= daily_limit THEN 'daily_limit_reached' ELSE sold_out_reason END
                    WHERE id = $2
                `, [item.quantity, item.menu_item_id]);

                await client.query(`
                    UPDATE ingredients i
                    SET current_stock_grams = i.current_stock_grams - (ri.quantity_grams * $1)
                    FROM recipe_ingredients ri
                    JOIN recipes r ON ri.recipe_id = r.id
                    JOIN ingredients orig_i ON ri.ingredient_id = orig_i.id
                    WHERE r.menu_item_id = $2 AND r.is_active = true 
                    AND i.name = orig_i.name AND i.kitchen_id = $3
                `, [item.quantity, item.menu_item_id, order.kitchen_id]);
            }

            // 5. Deduct Wallet
            if (order.wallet_deduction_paise > 0) {
                await client.query(`
                    UPDATE customer_wallet SET balance_paise = balance_paise - $1 WHERE customer_id = $2
                `, [order.wallet_deduction_paise, order.customer_id]);
                
                await client.query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, reference_id, description, balance_after_paise)
                    SELECT $1, -$2, 'debit', $3, 'Order payment', balance_paise FROM customer_wallet WHERE customer_id = $1
                `, [order.customer_id, order.wallet_deduction_paise, order.id]);
            }
            
            // 6. Handle Subscription Deduction
            if (order.is_subscription_order) {
                const { rows: subRows } = await client.query(`
                    UPDATE subscriptions 
                    SET remaining_meals = remaining_meals - 1,
                        current_day_credits = current_day_credits - 1,
                        updated_at = NOW()
                    WHERE customer_id = $1 AND is_active = true AND status = 'active' AND current_day_credits > 0
                    RETURNING id
                `, [order.customer_id]);
                
                if (subRows.length === 0) {
                    throw new Error('NO_ACTIVE_SUBSCRIPTION_OR_CREDITS');
                }
            }

            // 7. Award Loyalty Points
            const pointsToAward = Math.floor((finalizedOrder.total_amount_paise / 100) * TWO_QT.LOYALTY.POINTS_PER_HUNDRED_PAISE);
            if (pointsToAward > 0) {
                await client.query(`
                    INSERT INTO loyalty_transactions (customer_id, points, type, order_id, expires_at)
                    VALUES ($1, $2, 'earn', $3, NOW() + interval '180 days')
                `, [order.customer_id, pointsToAward, order.id]);
            }

            // 8. Emit All Balance Updates (Systematic Reactivity)
            if (order.wallet_deduction_paise > 0) {
                emitToUser(order.customer_id, 'wallet_updated', { balancePaise: (walletRows[0]?.balance_paise || 0) - order.wallet_deduction_paise });
            }
            if (pointsToAward > 0) {
                // Fetch current points to send accurate balance
                const { rows: pts } = await client.query('SELECT SUM(CASE WHEN type = \'earn\' THEN points ELSE -points END) as total FROM loyalty_transactions WHERE customer_id = $1', [order.customer_id]);
                emitToUser(order.customer_id, 'loyalty_updated', { points: parseInt(pts[0].total || '0') });
            }
            if (order.is_subscription_order) {
                emitToUser(order.customer_id, 'subscription_updated', { remainingMeals: -1 }); // Trigger a refresh on client
            }

            return finalizedOrder;
        });

        if (result.status === 'already_finalized') return result;

        const newOrder = result;

        await redis.set(keys.processedWebhook(gatewayOrderId), '1', { EX: 90000 });
        await redis.del(keys.pendingPayment(newOrder.customer_id));

        const orderCountResult = await query('SELECT count(*) FROM orders WHERE customer_id = $1', [newOrder.customer_id]);
        if (parseInt(orderCountResult?.rows[0]?.count ?? '0') === 1) {
            await processReferral(newOrder.customer_id, newOrder.id);
        }

        emitToKitchen(newOrder.kitchen_id, 'new_order', { orderId: newOrder.id });
        emitToRiders('new_available_mission', { orderId: newOrder.id, displayId: newOrder.display_id }, newOrder.zone_id);
        emitToUser(newOrder.customer_id, 'order_status_update', { orderId: newOrder.id, status: 'confirmed' });
        emitToAdmin('new_order', { orderId: newOrder.id, display_id: newOrder.display_id, status: 'confirmed' });

        await notificationsQueue.add('order_confirmed', {
            userId: newOrder.customer_id,
            displayId: newOrder.display_id,
            minutes: '25',
        });

        return { status: 'order_created', orderId: newOrder.id };
    } catch (err) {
        console.error('Order finalization failed:', err);
        throw err;
    }
}

export async function finalizeWalletRecharge(gatewayPaymentId: string, amountPaise: number, customerId: string) {
    const processed = await redis.get(keys.processedWebhook(gatewayPaymentId));
    if (processed) return { status: 'already_processed' };

    try {
        await withTransaction(async (client) => {
            // 1. Update Wallet
            await client.query(`
                INSERT INTO customer_wallet (customer_id, balance_paise)
                VALUES ($1, $2)
                ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
            `, [customerId, amountPaise]);

            // 2. Log Transaction
            await client.query(`
                INSERT INTO wallet_transactions (customer_id, amount_paise, type, reference_id, description, balance_after_paise)
                SELECT $1, $2, 'credit', $3, 'Wallet Top-up', balance_paise FROM customer_wallet WHERE customer_id = $1
            `, [customerId, amountPaise, gatewayPaymentId]);
        });

        await redis.set(keys.processedWebhook(gatewayPaymentId), '1', { EX: 90000 });

        const walletResult = await query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1', [customerId]);
        const newBalance = walletResult?.rows[0]?.balance_paise ?? amountPaise;
        emitToUser(customerId, 'wallet_updated', { balancePaise: newBalance });

        // Systematic Notification: Recharge Confirmed
        const userResult = await query('SELECT phone FROM users WHERE id = $1', [customerId]);
        const user = userResult?.rows;
        if (user?.[0]?.phone) {
            await notificationsQueue.add('broadcast_message', {
                phone: user[0]?.phone,
                message: `2QT: Your wallet recharge of ₹${amountPaise / 100} was successful! Balance updated instantly.`
            });
        }

        return { success: true };
    } catch (err) {
        console.error('Wallet recharge finalization failed:', err);
        throw err;
    }
}

