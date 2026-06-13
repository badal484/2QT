import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { authenticate, AuthRequest } from '../middleware/auth';
import { calculatePricing } from '../services/payment.service';
import { handleSubscriptionRenewal } from '../services/subscription.service';
import { redis, keys } from '../redis';
import { paymentLimiter } from '../middleware/rateLimiter';
import { query } from '../db';
import { finalizeOrder, createPendingOrder, finalizeWalletRecharge } from '../services/order.service';
import { TWO_QT } from '../config/constants';

const router = Router();

// Razorpay Setup
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

router.post('/create-order', authenticate, paymentLimiter, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const { items, addressId, promoCode, useWallet, useLoyalty, isSubscriptionOrder, paymentMethod = 'online', dryRun, instructions, scheduledAt, riderTipPaise } = req.body;

    try {
        const pricing = await calculatePricing({
            cartItems: items,
            addressId,
            promoCode,
            walletAmountPaise: useWallet ? 99999999 : 0,
            useLoyalty,
            isSubscriptionOrder,
            customerId,
            riderTipPaise
        });

        const { rows: wallet } = await query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1', [customerId]);
        const availableWallet = wallet[0]?.balance_paise || 0;

        if (dryRun) {
            return res.json({ pricing, availableWallet });
        }

        // SMART ORDER ROUTING (World-Class Quick Commerce)
        const { rows: addrInfo } = await query('SELECT zone_id, lat, lng FROM addresses WHERE id = $1 AND customer_id = $2', [addressId, customerId]);
        if (!addrInfo[0]) throw new Error('ADDRESS_NOT_FOUND');
        const { zone_id: zoneId, lat: custLat, lng: custLng } = addrInfo[0];

        // 1.1 Cross-Zone Validation: Ensure all cart items belong to the selected delivery zone
        const itemIds = items.map((i: any) => i.menuItemId);
        const { rows: itemZones } = await query('SELECT DISTINCT zone_id FROM menu_items WHERE id = ANY($1)', [itemIds]);
        if (itemZones.length > 1) {
            throw new Error('CART_MULTIPLE_ZONES: You cannot order items from multiple zones. Please clear your cart.');
        }
        if (itemZones.length === 1 && itemZones[0].zone_id !== zoneId) {
            throw new Error('CART_ZONE_MISMATCH: Your cart contains items from a different delivery zone. Please clear your cart.');
        }

        const { rows: kitchens } = await query(`
            SELECT k.id, k.lat, k.lng 
            FROM kitchens k
            JOIN kitchen_zones kz ON k.id = kz.kitchen_id
            WHERE kz.zone_id = $1 AND k.is_paused = false
        `, [zoneId]);
        
        if (kitchens.length === 0) throw new Error('NO_KITCHENS_AVAILABLE_FOR_ZONE');
        
        let kitchenId = kitchens[0].id;
        let minDistance = Infinity;
        const toRad = (val: number) => val * Math.PI / 180;
        
        kitchens.forEach(k => {
            const R = 6371;
            const dLat = toRad(k.lat - custLat);
            const dLng = toRad(k.lng - custLng);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(toRad(custLat)) * Math.cos(toRad(k.lat)) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            if (dist < minDistance) {
                minDistance = dist;
                kitchenId = k.id;
            }
        });

        const dbOrder = await createPendingOrder({
            customerId,
            kitchenId,
            zoneId,
            addressId,
            pricing,
            items,
            promoCode,
            isSubscriptionOrder,
            paymentMethod,
            instructions,
            scheduledAt
        });

        // 1.5 Deduct loyalty points immediately if used (Wallet is deducted at finalization, but points are simpler to lock here or we can just pass it to pending)
        if (pricing.loyaltyDiscountPaise > 0) {
            const pointsRedeemed = Math.round(pricing.loyaltyDiscountPaise / 100);
            await query(`
                INSERT INTO loyalty_transactions (customer_id, points, type, order_id)
                VALUES ($1, $2, 'redeem', $3)
            `, [customerId, pointsRedeemed, dbOrder.id]);
        }

        // 2. Handle COD
        if (paymentMethod === 'cod') {
            const codResult = await finalizeOrder(`COD_${dbOrder.id.slice(0, 8)}`, 'cod', dbOrder.id);
            return res.json({ 
                success: true, 
                orderId: dbOrder.id, 
                displayId: dbOrder.display_id,
                status: 'confirmed' 
            });
        }

        // 3. Handle Online (Razorpay)
        const rzpOrder = await razorpay.orders.create({
            amount: pricing.gatewayAmountPaise,
            currency: "INR",
            receipt: dbOrder.display_id,
            notes: {
                orderId: dbOrder.id,
                customerId
            }
        });

        // Update order with gateway ID
        await query('UPDATE orders SET gateway_order_id = $1 WHERE id = $2', [rzpOrder.id, dbOrder.id]);

        // Keep redis for legacy/fallback but DB is primary now
        await redis.set(keys.pendingOrder(rzpOrder.id), JSON.stringify({
            customerId,
            kitchenId,
            zoneId,
            items,
            addressId,
            pricing,
            promoCode
        }), { EX: 3600 });

        res.json({
            orderId: dbOrder.id,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            keyId: process.env.RAZORPAY_KEY_ID,
            pricing
        });

    } catch (err: any) {
        console.error('ORDER_CREATION_ERROR:', err);
        res.status(400).json({ error: 'ORDER_FAILED', message: err.message });
    }
});

router.post('/wallet/recharge', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const { amountPaise } = req.body;

    if (!amountPaise || amountPaise < 10000) {
        return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Minimum recharge is ₹100' });
    }

    try {
        const rzpOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `WL_${customerId.slice(0, 8)}_${Date.now()}`,
            notes: {
                type: 'wallet_recharge',
                customerId
            }
        });

        res.json({
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (err: any) {
        res.status(500).json({ error: 'RECHARGE_FAILED', message: err.message });
    }
});

router.post('/subscription/purchase', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const { planId } = req.body;

    const plans = TWO_QT.SUBSCRIPTION.PLANS;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: 'INVALID_PLAN' });

    try {
        const rzpOrder = await razorpay.orders.create({
            amount: plan.pricePaise,
            currency: "INR",
            receipt: `SUB_${customerId.slice(0, 8)}_${Date.now()}`,
            notes: {
                type: 'subscription_purchase',
                planId,
                customerId
            }
        });

        res.json({
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            keyId: process.env.RAZORPAY_KEY_ID,
            planName: plan.name
        });
    } catch (err: any) {
        res.status(500).json({ error: 'SUBSCRIPTION_PURCHASE_FAILED', message: err.message });
    }
});

router.post('/verify-payment', authenticate, async (req: AuthRequest, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, type = 'order' } = req.body;
    const customerId = req.user!.userId;

    // Verify Signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || '')
        .update(body.toString())
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'INVALID_SIGNATURE' });
    }

    try {
        if (type === 'wallet') {
            const { amountPaise } = req.body; // Amount should be passed or fetched from RZP
            await finalizeWalletRecharge(razorpay_payment_id, amountPaise, customerId);
            return res.json({ success: true, message: 'Wallet recharged' });
        } else if (type === 'subscription') {
            const { planId } = req.body;
            const subId = await handleSubscriptionRenewal(customerId, planId);
            return res.json({ success: true, subscriptionId: subId });
        } else {
            const result = await finalizeOrder(razorpay_order_id, 'online');
            return res.json(result);
        }
    } catch (err: any) {
        res.status(500).json({ error: 'VERIFICATION_FAILED', message: err.message });
    }
});

router.post('/mock-success', authenticate, async (req: AuthRequest, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const { razorpayOrderId } = req.body;
    
    try {
        const pendingData = await redis.get(keys.pendingOrder(razorpayOrderId));
        if (!pendingData) return res.status(404).json({ error: 'PENDING_ORDER_NOT_FOUND' });

        const pending = JSON.parse(pendingData);
        const result = await finalizeOrder(razorpayOrderId, 'online', pending.orderId || 'MOCK');
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'MOCK_FAILED', message: err.message });
    }
});

export default router;
