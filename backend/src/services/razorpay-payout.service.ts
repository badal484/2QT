import { query } from '../db';

// Uses RazorpayX Payouts API (same key as payment gateway, requires RazorpayX enabled)
// Env required: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_ACCOUNT_NUMBER (RazorpayX account)

function authHeader() {
    const key = process.env.RAZORPAY_KEY_ID || '';
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

async function rpxPost(path: string, body: any) {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (!res.ok) {
        throw new Error(data?.error?.description || `RazorpayX API error ${res.status}`);
    }
    return data;
}

// ─── Create Contact (person receiving money) ──────────────────────────────────

export async function createContact(name: string, phone: string, type: 'vendor' | 'employee' = 'vendor') {
    const data = await rpxPost('/contacts', { name, contact: phone, type });
    return data.id as string;
}

// ─── Create Fund Account (UPI VPA) ───────────────────────────────────────────

export async function createFundAccountUPI(contactId: string, upiId: string) {
    const data = await rpxPost('/fund_accounts', {
        contact_id: contactId,
        account_type: 'vpa',
        vpa: { address: upiId },
    });
    return data.id as string;
}

// ─── Fire a UPI Payout ────────────────────────────────────────────────────────

export async function firePayout(fundAccountId: string, amountPaise: number, narration: string, referenceId: string) {
    const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER;
    if (!accountNumber) throw new Error('RAZORPAY_ACCOUNT_NUMBER not set — add to .env and Render dashboard');

    const data = await rpxPost('/payouts', {
        account_number: accountNumber,
        fund_account_id: fundAccountId,
        amount: amountPaise,
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        queue_if_low_balance: true,
        narration: narration.slice(0, 30),
        reference_id: referenceId,
    });

    return {
        payoutId: data.id as string,
        status: data.status as string,
        utr: (data.utr || null) as string | null,
    };
}

// ─── Ensure kitchen has a Razorpay fund account (create once, reuse forever) ──

export async function ensureKitchenFundAccount(kitchen: {
    id: string; name: string; upi_id: string;
    contact_phone?: string; contact_email?: string;
    razorpay_contact_id?: string; razorpay_fund_account_id?: string;
}) {
    if (kitchen.razorpay_fund_account_id) return kitchen.razorpay_fund_account_id;

    const phone = (kitchen.contact_phone || '').replace(/\D/g, '') || '0000000000';
    const contactId = await createContact(kitchen.name, phone, 'vendor');
    const fundAccountId = await createFundAccountUPI(contactId, kitchen.upi_id);

    await query(`UPDATE kitchens SET razorpay_contact_id = $1, razorpay_fund_account_id = $2 WHERE id = $3`,
        [contactId, fundAccountId, kitchen.id]);

    return fundAccountId;
}

// ─── Ensure rider has a Razorpay fund account ─────────────────────────────────

export async function ensureRiderFundAccount(rider: {
    id: string; name: string; phone: string; upi_id: string;
    razorpay_contact_id?: string; razorpay_fund_account_id?: string;
}) {
    if (rider.razorpay_fund_account_id) return rider.razorpay_fund_account_id;

    const phone = rider.phone.replace(/\D/g, '');
    const contactId = await createContact(rider.name, phone, 'employee');
    const fundAccountId = await createFundAccountUPI(contactId, rider.upi_id);

    await query(`UPDATE users SET razorpay_contact_id = $1, razorpay_fund_account_id = $2 WHERE id = $3`,
        [contactId, fundAccountId, rider.id]);

    return fundAccountId;
}

// ─── Check if Razorpay auto-pay is configured ─────────────────────────────────

export function isAutoPayConfigured() {
    return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_ACCOUNT_NUMBER);
}
