import Razorpay from 'razorpay';
import { withTransaction, query } from '../db';
import { emitToUser, emitToAll } from '../socket';
import { NotificationService } from './notification.service';
import { logSystemEvent } from '../utils/logger';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export interface RefundParams {
    orderId: string;
    customerId: string;
    amountPaise: number;
    reason: string;
    initiatedBy?: string;   // undefined = customer self-cancel
    complaintId?: string;
    razorpayPaymentId?: string;
}

// ─── Wallet Refund ────────────────────────────────────────────────────────────
// Instant in-app wallet credit. Used for: self-cancel (wallet choice),
// finance approving wallet refund, COD wallet-portion reversal.

export async function processWalletRefund(
    params: RefundParams & { refundRecordId?: string }
): Promise<{ newWalletBalance: number }> {
    const { orderId, customerId, amountPaise, reason, initiatedBy, refundRecordId } = params;
    let newWalletBalance = 0;

    await withTransaction(async (client) => {
        const { rows: orders } = await client.query(
            'SELECT display_id, total_amount_paise, payment_status FROM orders WHERE id = $1 FOR UPDATE',
            [orderId]
        );
        if (!orders[0]) throw new Error('ORDER_NOT_FOUND');
        const order = orders[0];

        // Credit wallet
        await client.query(`
            INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, $2)
            ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
        `, [customerId, amountPaise]);

        // Wallet transaction log
        await client.query(`
            INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
            SELECT $1, $2, 'credit', $3, balance_paise
            FROM customer_wallet WHERE customer_id = $1
        `, [customerId, amountPaise, `Refund for order #${order.display_id}: ${reason}`]);

        // Read actual new balance
        const { rows: wb } = await client.query(
            'SELECT balance_paise FROM customer_wallet WHERE customer_id = $1',
            [customerId]
        );
        newWalletBalance = wb[0]?.balance_paise ?? amountPaise;

        // Update order payment_status
        const isPartial = amountPaise < order.total_amount_paise;
        const newPayStatus = isPartial ? 'partially_refunded' : 'refunded';
        if (!['refunded', 'partially_refunded'].includes(order.payment_status)) {
            await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', [newPayStatus, orderId]);
        }

        // Update or create refund record
        if (refundRecordId) {
            await client.query(`
                UPDATE refunds
                SET status = 'processed', refund_type = 'wallet', approved_by = $1, processed_at = NOW()
                WHERE id = $2
            `, [initiatedBy || null, refundRecordId]);
        } else {
            await client.query(`
                INSERT INTO refunds
                  (order_id, customer_id, amount_paise, refund_type, reason, status, initiated_by, processed_at)
                VALUES ($1, $2, $3, 'wallet', $4, 'processed', $5, NOW())
            `, [orderId, customerId, amountPaise, reason, initiatedBy || null]);
        }
    });

    emitToUser(customerId, 'wallet_updated', { balancePaise: newWalletBalance });
    emitToAll('refund_updated', { action: 'processed', orderId });

    NotificationService.send('broadcast_message', {
        userId: customerId,
        title: 'Refund Credited',
        body: `₹${(amountPaise / 100).toFixed(0)} has been added to your 2QT wallet.`,
    }).catch(() => {});

    logSystemEvent('WALLET_REFUND', `Wallet refund ₹${amountPaise / 100} → customer ${customerId}`, 'info', { orderId, amountPaise });
    return { newWalletBalance };
}

// ─── Bank Refund (Razorpay) ───────────────────────────────────────────────────
// Calls Razorpay API to reverse the original payment. Takes 5–7 days for
// card/net-banking; instant for UPI if speed='optimum'.

export async function processBankRefund(
    params: RefundParams & { razorpayPaymentId: string; refundRecordId?: string; approvedBy?: string }
): Promise<{ rzpRefundId: string; immediate: boolean }> {
    const { orderId, customerId, amountPaise, reason, initiatedBy, refundRecordId, razorpayPaymentId, approvedBy } = params;

    // Call Razorpay
    const rzpRefund = await (razorpay.payments as any).refund(razorpayPaymentId, {
        amount: amountPaise,
        speed: 'optimum',
        notes: { reason, orderId },
    }) as { id: string; status: string };

    const immediate = rzpRefund.status === 'processed';

    await withTransaction(async (client) => {
        const { rows: orders } = await client.query(
            'SELECT display_id, total_amount_paise, payment_status FROM orders WHERE id = $1',
            [orderId]
        );
        if (!orders[0]) throw new Error('ORDER_NOT_FOUND');
        const order = orders[0];

        // Mark order as refunded — money will arrive even if Razorpay takes time
        const isPartial = amountPaise < order.total_amount_paise;
        const newPayStatus = isPartial ? 'partially_refunded' : 'refunded';
        if (!['refunded', 'partially_refunded'].includes(order.payment_status)) {
            await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', [newPayStatus, orderId]);
        }

        if (refundRecordId) {
            await client.query(`
                UPDATE refunds SET
                    status            = $1,
                    refund_type       = 'bank',
                    razorpay_refund_id = $2,
                    approved_by       = $3,
                    processed_at      = CASE WHEN $4 THEN NOW() ELSE NULL END
                WHERE id = $5
            `, [immediate ? 'processed' : 'processing', rzpRefund.id, approvedBy || null, immediate, refundRecordId]);
        } else {
            await client.query(`
                INSERT INTO refunds
                  (order_id, customer_id, amount_paise, refund_type, reason, status,
                   initiated_by, razorpay_payment_id, razorpay_refund_id, processed_at)
                VALUES ($1, $2, $3, 'bank', $4, $5, $6, $7, $8, $9)
            `, [
                orderId, customerId, amountPaise, reason,
                immediate ? 'processed' : 'processing',
                initiatedBy || null, razorpayPaymentId, rzpRefund.id,
                immediate ? new Date() : null,
            ]);
        }
    });

    emitToAll('refund_updated', { action: immediate ? 'processed' : 'processing', orderId });

    NotificationService.send('broadcast_message', {
        userId: customerId,
        title: 'Refund Initiated',
        body: immediate
            ? `₹${(amountPaise / 100).toFixed(0)} has been refunded to your bank account.`
            : `₹${(amountPaise / 100).toFixed(0)} refund has been initiated. It will reach your bank in 5–7 business days.`,
    }).catch(() => {});

    logSystemEvent('BANK_REFUND', `Bank refund ₹${amountPaise / 100} via Razorpay rfnd=${rzpRefund.id}`, 'info', { orderId, rzpRefundId: rzpRefund.id });
    return { rzpRefundId: rzpRefund.id, immediate };
}

// ─── Create Pending Refund ────────────────────────────────────────────────────
// Used by admin cancel, complaint resolve, and admin manual refund.
// Creates a pending record in the refunds table. Finance team processes it.

export async function createPendingRefund(params: RefundParams): Promise<string> {
    const { orderId, customerId, amountPaise, reason, initiatedBy, complaintId, razorpayPaymentId } = params;

    const { rows } = await query(`
        INSERT INTO refunds
          (order_id, customer_id, complaint_id, amount_paise, refund_type, reason,
           status, initiated_by, razorpay_payment_id)
        VALUES ($1, $2, $3, $4,
          CASE WHEN $5 IS NOT NULL THEN 'bank' ELSE 'wallet' END,
          $6, 'pending', $7, $5)
        RETURNING id
    `, [orderId, customerId, complaintId || null, amountPaise, razorpayPaymentId || null, reason, initiatedBy || null]);

    // Mark order as refund_pending so it shows clearly in finance
    await query(`UPDATE orders SET payment_status = 'refund_pending' WHERE id = $1
                 AND payment_status NOT IN ('refunded', 'partially_refunded', 'refund_pending')`, [orderId]);

    emitToAll('refund_updated', { action: 'pending', orderId, refundId: rows[0].id });
    return rows[0].id;
}
