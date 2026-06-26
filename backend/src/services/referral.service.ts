import { query, withTransaction } from '../db';
import { TWO_QT } from '../config/constants';
import { emitToUser } from '../socket';
import { NotificationService } from './notification.service';

export const processReferral = async (referredId: string, firstOrderId: string) => {
    const { rows: referrals } = await query('SELECT * FROM referrals WHERE referred_id = $1 AND status = \'pending\'', [referredId]);
    const referral = referrals[0];

    if (!referral) return;

    const { rows: orders } = await query('SELECT total_amount_paise FROM orders WHERE id = $1', [firstOrderId]);
    const orderAmount = orders[0].total_amount_paise;
    const { REFERRAL } = TWO_QT;

    // RULE: Reward after Friend's first order > Threshold
    if (orderAmount < REFERRAL.MIN_FIRST_ORDER_PAISE) {
        console.log(`[REFERRAL] Order amount ${orderAmount} too low for reward.`);
        return;
    }

    // SYSTEMATIC INTEGRATION: Fraud Guard Engine
    let fraudScore = 0;
    const { rows: referrerData } = await query('SELECT last_ip, device_id FROM users WHERE id = $1', [referral.referrer_id]);
    const { rows: referredData } = await query('SELECT last_ip, device_id FROM users WHERE id = $1', [referredId]);

    if (referrerData[0] && referredData[0]) {
        if (referrerData[0].device_id === referredData[0].device_id) fraudScore += 100;
        if (referrerData[0].last_ip === referredData[0].last_ip) fraudScore += 50;
    }

    if (fraudScore >= 50) {
        console.warn(`[REFERRAL_FRAUD] Detected! Score: ${fraudScore} for Referral ${referral.id}`);
        await query('UPDATE referrals SET status = \'fraud_detected\', fraud_score = $1 WHERE id = $2', [fraudScore, referral.id]);
        return;
    }

    // SYSTEMATIC INTEGRATION: Monthly Reward Cap
    const { rows: monthlyReward } = await query(`
        SELECT COALESCE(SUM(amount_paise), 0) as total 
        FROM wallet_transactions 
        WHERE customer_id = $1 AND type = 'credit' AND description LIKE 'Referral reward%'
        AND created_at > NOW() - INTERVAL '30 days'
    `, [referral.referrer_id]);

    if (parseInt(monthlyReward[0].total) >= 50000) { // ₹500 Cap
        console.log(`[REFERRAL] Cap reached for Referrer ${referral.referrer_id}`);
        await query('UPDATE referrals SET status = \'cap_reached\' WHERE id = $1', [referral.id]);
        return;
    }

    await withTransaction(async (client) => {
        // 1. Credit Referrer ONLY (Friend was credited at signup)
        await client.query(`
            UPDATE customer_wallet 
            SET balance_paise = balance_paise + $1 
            WHERE customer_id = $2
        `, [REFERRAL.REFERRER_REWARD_PAISE, referral.referrer_id]);

        await client.query(`
            INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
            SELECT $1, $2, 'credit', 'Referral reward for ' || u.name, balance_paise 
            FROM customer_wallet, users u WHERE customer_wallet.customer_id = $1 AND u.id = $3
        `, [referral.referrer_id, REFERRAL.REFERRER_REWARD_PAISE, referredId]);
        
        // 2. Update Referral Status
        await client.query(`
            UPDATE referrals 
            SET status = 'rewarded', 
                order_id = $1, 
                referrer_rewarded_at = NOW()
            WHERE id = $2
        `, [firstOrderId, referral.id]);
    });

    // 3. Notify Referrer
    const { rows: rWallet } = await query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1', [referral.referrer_id]);
    const { rows: referrer } = await query('SELECT phone FROM users WHERE id = $1', [referral.referrer_id]);
    
    emitToUser(referral.referrer_id, 'wallet_updated', { balancePaise: rWallet[0].balance_paise });
    
    if (referrer[0]?.phone) {
        NotificationService.send('broadcast_message', {
            phone: referrer[0].phone,
            title: 'Referral Reward!',
            body: `2QT: Great news! Your referral reward of ₹50 is now in your wallet. Keep sharing and earning!`,
        }).catch(() => {});
    }

    console.log(`--- SYSTEMATIC REFERRAL COMPLETE: Referrer ${referral.referrer_id} rewarded ---`);
};
