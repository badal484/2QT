import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';

export const resetDailyCredits = async () => {
    console.log('[SUBSCRIPTION] Resetting daily credits...');
    
    // 1. Mark expired subscriptions
    await query("UPDATE subscriptions SET is_active = false WHERE expires_at < NOW() AND is_active = true");

    // 2. Reset credits for active subscriptions
    // If it's a new day, we reset current_day_credits to 1 (or 0 if paused)
    await withTransaction(async (client) => {
        await client.query(`
            UPDATE subscriptions 
            SET current_day_credits = CASE WHEN is_paused = true THEN 0 ELSE 1 END,
                updated_at = NOW()
            WHERE is_active = true
        `);
    });
};

// gatewayPaymentId is required so this can be deduplicated against the Razorpay
// payment it's actually granting a subscription for — this function used to have
// no idempotency guard at all, and is reachable from both the payment webhook and
// the client's own /verify-payment call for the same payment, so either a webhook
// retry or a repeated client call would previously grant a brand-new subscription
// each time. Mirrors the same Redis-dedup pattern already used in finalizeWalletRecharge.
export const handleSubscriptionRenewal = async (customerId: string, planId: string, gatewayPaymentId: string) => {
    const processed = await redis.get(keys.processedWebhook(gatewayPaymentId)).catch(() => null);
    if (processed) return processed; // already granted for this payment — return the existing subscription id

    const subId = await withTransaction(async (client) => {
        // 1. Get current active subscription
        const { rows: currentSubs } = await client.query(
            "SELECT * FROM subscriptions WHERE customer_id = $1 AND is_active = true",
            [customerId]
        );
        
        let carryForward = 0;
        if (currentSubs.length > 0) {
            const sub = currentSubs[0];
            // Carry forward logic: remaining meals capped at 2
            carryForward = Math.min(sub.remaining_meals, 2);
            
            // Mark old sub as completed
            await client.query("UPDATE subscriptions SET is_active = false WHERE id = $1", [sub.id]);
        }

        // 2. Plan details (Hardcoded for now)
        const plans: Record<string, { meals: number; price: number }> = {
            'sub_lunch_20': { meals: 20, price: 199900 },
            'sub_lunch_30': { meals: 30, price: 279900 },
            'sub_dinner_20': { meals: 20, price: 219900 },
            'sub_dinner_30': { meals: 30, price: 299900 }
        };

        const plan = plans[planId];
        if (!plan) throw new Error('INVALID_PLAN');

        // 3. Create new subscription
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (plan.meals === 20 ? 25 : 35)); // Buffer for weekends/pauses

        const { rows: newSub } = await client.query(`
            INSERT INTO subscriptions (
                customer_id, plan_id, total_meals, remaining_meals, 
                current_day_credits, expires_at, is_active
            ) VALUES ($1, $2, $3, $4, 1, $5, true)
            RETURNING id
        `, [customerId, planId, plan.meals + carryForward, plan.meals + carryForward, expiresAt]);

        const { emitToUser } = require('../socket');
        emitToUser(customerId, 'subscription_updated', { planId, status: 'active' });

        return newSub[0].id;
    });

    await redis.set(keys.processedWebhook(gatewayPaymentId), subId, { EX: 90000 }).catch(e => console.error('Redis set failed', e.message));
    return subId;
};

export const consumeCredit = async (subscriptionId: string) => {
    return await withTransaction(async (client) => {
        const { rows } = await client.query(
            "SELECT * FROM subscriptions WHERE id = $1 AND is_active = true AND current_day_credits > 0",
            [subscriptionId]
        );

        if (rows.length === 0) throw new Error('NO_CREDITS_LEFT');

        await client.query(`
            UPDATE subscriptions 
            SET current_day_credits = current_day_credits - 1,
                remaining_meals = remaining_meals - 1,
                updated_at = NOW()
            WHERE id = $1
        `, [subscriptionId]);
    });
};
