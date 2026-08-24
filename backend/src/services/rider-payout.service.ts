import { query } from '../db';
import { emitToUser } from '../socket';
import { ensureRiderFundAccount, firePayout, isAutoPayConfigured } from './razorpay-payout.service';
import { NotificationService } from './notification.service';

export interface SalariedRider {
    id: string;
    name: string;
    phone: string;
    upi_id: string | null;
    razorpay_contact_id?: string | null;
    razorpay_fund_account_id?: string | null;
    pending_deductions: number | string;
    monthly_salary_paise: number | string;
}

export type SalaryPayoutResult =
    | { status: 'absorbed'; netPaise: 0 }
    | { status: 'paid'; netPaise: number; payoutRowId: string }
    | { status: 'pending'; netPaise: number; payoutRowId: string };

// Pays one salaried rider their fixed monthly salary (minus any pending
// complaint deductions). Shared by the 1st-of-month cron and the admin
// "Pay Salary Now" manual-trigger endpoint so the payout logic — and the
// resulting rider notification — never drifts between the two call sites.
export async function payoutMonthlySalaryForRider(rider: SalariedRider, periodLabel: string): Promise<SalaryPayoutResult> {
    const salaryPaise = parseInt(String(rider.monthly_salary_paise), 10);
    const deductions = parseInt(String(rider.pending_deductions), 10);
    const complaintDeduction = Math.min(deductions, salaryPaise);
    const netPaise = Math.max(0, salaryPaise - complaintDeduction);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    if (netPaise <= 0) {
        if (complaintDeduction > 0) {
            await query(
                `UPDATE users SET pending_deductions_paise = pending_deductions_paise - $1 WHERE id = $2`,
                [complaintDeduction, rider.id]
            );
        }
        return { status: 'absorbed', netPaise: 0 };
    }

    const mode = (isAutoPayConfigured() && rider.upi_id) ? 'auto' : 'manual';
    const { rows: pr } = await query(`
        INSERT INTO weekly_payouts
          (rider_id, week_start, week_end, net_amount_paise,
           status, payout_mode, payout_type, complaint_deduction_paise, upi_id)
        VALUES ($1, $2, $2, $3, 'processing', $4, 'salary_monthly', $5, $6)
        RETURNING id
    `, [rider.id, today, netPaise, mode, complaintDeduction, rider.upi_id || null]);
    const payoutRowId = pr[0].id;

    let result: SalaryPayoutResult;
    if (mode === 'auto') {
        const fundAccountId = await ensureRiderFundAccount({
            id: rider.id, name: rider.name, phone: rider.phone, upi_id: rider.upi_id!,
            razorpay_contact_id: rider.razorpay_contact_id || undefined,
            razorpay_fund_account_id: rider.razorpay_fund_account_id || undefined,
        });
        const payout = await firePayout(
            fundAccountId,
            netPaise,
            `2QT Salary ${periodLabel}`,
            `2QT-S-${rider.id.slice(0, 8)}-${today}`
        );
        await query(`
            UPDATE weekly_payouts
            SET status = 'paid', paid_at = NOW(),
                razorpay_payout_id = $1, utr_number = $2
            WHERE id = $3
        `, [payout.payoutId, payout.utr, payoutRowId]);
        result = { status: 'paid', netPaise, payoutRowId };
    } else {
        await query(`UPDATE weekly_payouts SET status = 'pending' WHERE id = $1`, [payoutRowId]);
        result = { status: 'pending', netPaise, payoutRowId };
    }

    if (complaintDeduction > 0) {
        await query(
            `UPDATE users SET pending_deductions_paise = pending_deductions_paise - $1 WHERE id = $2`,
            [complaintDeduction, rider.id]
        );
    }

    emitToUser(rider.id, 'earnings_updated', { payoutId: payoutRowId, amountPaise: netPaise, status: result.status === 'paid' ? 'paid' : 'pending' });
    NotificationService.send('rider_payout', {
        userId: rider.id,
        amount: (netPaise / 100).toFixed(0),
        upiId: rider.upi_id || 'your account',
    }).catch(e => console.error('[rider-payout.service/notify]', e.message));

    return result;
}
