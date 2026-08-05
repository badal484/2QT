import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — 2QT',
  description: 'Understand how cancellations and refunds work on the 2QT food delivery platform.',
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-[#05050A] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-[#FF6B35] text-sm hover:underline mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Refund & Cancellation Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <section className="bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-2xl p-5">
            <p className="text-[#FF6B35] font-semibold mb-1">Quick Summary</p>
            <p className="text-zinc-300">Cancel before the kitchen starts preparing → full refund to wallet. Cancel after → no refund for food cost. Wrong item or quality issue → instant refund, no questions asked.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">1. Order Cancellation by You</h2>
            <div className="space-y-3">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-green-400 font-semibold mb-1">Before kitchen starts preparing (within ~2 minutes of placing)</p>
                <p className="text-zinc-400">Full refund to your 2QT Wallet. Wallet credits are available instantly and can be used on your next order.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-amber-400 font-semibold mb-1">After kitchen has started preparing</p>
                <p className="text-zinc-400">Cancellation may not be possible once preparation has begun. If cancellation is accepted, a partial refund (excluding food preparation cost) may be issued at our discretion.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-red-400 font-semibold mb-1">After the order is out for delivery</p>
                <p className="text-zinc-400">Cancellation is not available. The order cannot be recalled once a rider has picked it up.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">2. Order Cancellation by Us</h2>
            <p className="mb-2">We may cancel your order in the following situations, with a full refund:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Kitchen is temporarily unavailable or has closed</li>
              <li>Items ordered are out of stock</li>
              <li>No delivery rider is available in your area</li>
              <li>Suspected fraudulent activity or payment failure</li>
              <li>Delivery address is outside our service zone</li>
              <li>Extreme weather or force majeure events</li>
            </ul>
            <p className="mt-2">In all such cases, a full refund will be credited to your 2QT Wallet within 5–10 minutes.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">3. Refunds for Issues with Your Order</h2>
            <p className="mb-3">We take food quality seriously. If there is an issue with your delivered order, you are eligible for a refund or replacement:</p>
            <div className="space-y-2">
              {[
                { issue: 'Wrong item delivered', resolution: 'Full refund to wallet or free re-delivery' },
                { issue: 'Item missing from order', resolution: 'Refund for the missing item(s) to wallet' },
                { issue: 'Food quality issue (spoiled, foreign object)', resolution: 'Full refund + escalation to kitchen' },
                { issue: 'Order significantly delayed (>60 min past ETA)', resolution: 'Partial refund or discount coupon at our discretion' },
                { issue: 'Order not received', resolution: 'Full refund after verification' },
              ].map(({ issue, resolution }) => (
                <div key={issue} className="flex gap-3 bg-white/5 rounded-xl p-4">
                  <div className="flex-1">
                    <p className="text-white font-medium text-xs">{issue}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">{resolution}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-zinc-500 text-xs">Raise an issue within 24 hours of delivery via the app's Help section or at <a href="mailto:support@go2qt.com" className="text-[#FF6B35] hover:underline">support@go2qt.com</a>. We may request photo evidence for quality complaints.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">4. Refund Methods</h2>
            <div className="space-y-3">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white font-semibold mb-1">2QT Wallet (Default)</p>
                <p className="text-zinc-400">Instant. Wallet balance can be used for any future order on 2QT. This is the fastest refund method.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white font-semibold mb-1">Original Payment Method</p>
                <p className="text-zinc-400">Available on request for orders paid via UPI/card. Processing time: 5–7 business days (as per Razorpay's refund timeline). Requires approval from our finance team.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">5. Subscription Plans</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Subscription plans (weekly/monthly meal plans) are non-refundable once activated and the first meal has been delivered.</li>
              <li>If you have not used any meals, you may request a full refund within 24 hours of purchase.</li>
              <li>Unused meals at the end of a subscription period are not carried forward or refunded.</li>
              <li>We may pause your subscription if kitchen operations are temporarily unavailable in your zone.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">6. Wallet Balance</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Wallet balance cannot be withdrawn or transferred to a bank account.</li>
              <li>Wallet credits are valid for 12 months from the date of credit.</li>
              <li>Promotional wallet credits may have shorter validity — check the credit description in the app.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">7. How to Request a Refund</h2>
            <ol className="space-y-2 list-decimal list-inside text-zinc-400">
              <li>Open the 2QT app → Orders → Select your order</li>
              <li>Tap "Help with this order" or "Report an issue"</li>
              <li>Select the relevant issue type</li>
              <li>Our team reviews and processes eligible refunds within 1 business day</li>
            </ol>
            <p className="mt-2">You can also email us at <a href="mailto:support@go2qt.com" className="text-[#FF6B35] hover:underline">support@go2qt.com</a> with your order ID and issue description.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">8. Disputes</h2>
            <p>If you believe a refund decision was incorrect, you may escalate by emailing <a href="mailto:support@go2qt.com" className="text-[#FF6B35] hover:underline">support@go2qt.com</a> with subject line "Refund Dispute — [Order ID]". We aim to resolve all disputes within 3 business days. Unresolved disputes are subject to the Consumer Protection Act 2019 and jurisdiction of courts in India.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
