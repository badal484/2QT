import { query, withTransaction } from '../db';

export const earnPoints = async (customerId: string, orderId: string, amountPaise: number) => {
    // 1pt per ₹100 spent (10000 paise)
    const points = Math.floor(amountPaise / 10000);
    if (points <= 0) return;

    await withTransaction(async (client) => {
        // Log transaction
        await client.query(`
            INSERT INTO loyalty_transactions (customer_id, order_id, points, type)
            VALUES ($1, $2, $3, 'earn')
        `, [customerId, orderId, points]);

        // Note: The actual balance should be calculated via a view or updated here
        // Assuming we might want a 'loyalty_balance' in users table or just sum the transactions.
        // For performance, let's keep it in transactions for now.
    });
};

export const redeemPoints = async (customerId: string, pointsToRedeem: number): Promise<number> => {
    // ₹1 per 10pts (100 paise)
    return await withTransaction(async (client) => {
        const { rows: balanceRes } = await client.query(`
            SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -points END), 0) as total_points
            FROM loyalty_transactions WHERE customer_id = $1
        `, [customerId]);

        const currentPoints = parseInt(balanceRes[0].total_points);
        if (currentPoints < pointsToRedeem) throw new Error('INSUFFICIENT_POINTS');

        const valuePaise = pointsToRedeem * 10; // 10pts = ₹1 = 100 paise -> 1pt = 10 paise

        await client.query(`
            INSERT INTO loyalty_transactions (customer_id, points, type)
            VALUES ($1, $2, 'redeem')
        `, [customerId, pointsToRedeem]);

        return valuePaise;
    });
};
