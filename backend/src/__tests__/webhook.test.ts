import crypto from 'crypto';

const WEBHOOK_SECRET = 'test_webhook_secret';

function computeRazorpaySignature(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = computeRazorpaySignature(rawBody, secret);
  return expected === signature;
}

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

describe('Razorpay Webhook Signature Verification', () => {
  const rawBody = JSON.stringify({ event: 'order.paid', payload: {} });

  it('accepts a valid signature', () => {
    const sig = computeRazorpaySignature(rawBody, WEBHOOK_SECRET);
    expect(verifyRazorpaySignature(rawBody, sig, WEBHOOK_SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = computeRazorpaySignature(rawBody, WEBHOOK_SECRET);
    const tamperedBody = JSON.stringify({ event: 'order.paid', payload: { injected: true } });
    expect(verifyRazorpaySignature(tamperedBody, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const sig = computeRazorpaySignature(rawBody, 'wrong_secret');
    expect(verifyRazorpaySignature(rawBody, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(verifyRazorpaySignature(rawBody, '', WEBHOOK_SECRET)).toBe(false);
  });

  it('is deterministic — same input always produces same signature', () => {
    const sig1 = computeRazorpaySignature(rawBody, WEBHOOK_SECRET);
    const sig2 = computeRazorpaySignature(rawBody, WEBHOOK_SECRET);
    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different events', () => {
    const body1 = JSON.stringify({ event: 'order.paid' });
    const body2 = JSON.stringify({ event: 'payment.failed' });
    const sig1 = computeRazorpaySignature(body1, WEBHOOK_SECRET);
    const sig2 = computeRazorpaySignature(body2, WEBHOOK_SECRET);
    expect(sig1).not.toBe(sig2);
  });
});

describe('Razorpay Payment Signature Verification', () => {
  const ORDER_ID = 'order_test123';
  const PAYMENT_ID = 'pay_test456';
  const SECRET = 'test_secret';

  it('verifies a valid payment signature', () => {
    const body = `${ORDER_ID}|${PAYMENT_ID}`;
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifyPaymentSignature(ORDER_ID, PAYMENT_ID, sig, SECRET)).toBe(true);
  });

  it('rejects mismatched order ID', () => {
    const body = `${ORDER_ID}|${PAYMENT_ID}`;
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifyPaymentSignature('wrong_order', PAYMENT_ID, sig, SECRET)).toBe(false);
  });

  it('rejects mismatched payment ID', () => {
    const body = `${ORDER_ID}|${PAYMENT_ID}`;
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifyPaymentSignature(ORDER_ID, 'wrong_payment', sig, SECRET)).toBe(false);
  });

  it('rejects completely fabricated signature', () => {
    expect(verifyPaymentSignature(ORDER_ID, PAYMENT_ID, 'fakesig', SECRET)).toBe(false);
  });

  it('uses pipe separator between order and payment IDs', () => {
    // Ensure no separator confusion (e.g. space vs pipe)
    const withSpace = `${ORDER_ID} ${PAYMENT_ID}`;
    const sigWrongFormat = crypto.createHmac('sha256', SECRET).update(withSpace).digest('hex');
    expect(verifyPaymentSignature(ORDER_ID, PAYMENT_ID, sigWrongFormat, SECRET)).toBe(false);
  });
});
