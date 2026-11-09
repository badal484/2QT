import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — 2QT',
  description: 'Terms and conditions for using the 2QT food delivery platform.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#05050A] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-[#FF6B35] text-sm hover:underline mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-base mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using the Eigen Foods platform ("Service"), operated by Eigen Foods ("Company", "we", "us"), you agree to be bound by these Terms of Service. If you do not agree, do not use our Service. These terms govern your use of our website, mobile applications, and related services.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">2. Eligibility</h2>
            <p>You must be at least 18 years old to create an account and place orders. By using the Service, you represent that you meet this requirement. We reserve the right to refuse service to any person at our discretion.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">3. Orders and Payments</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Prices displayed are inclusive of applicable taxes (GST) unless stated otherwise.</li>
              <li>Payment is required at the time of placing an order. We accept UPI, credit/debit cards, net banking, and wallet balance via Razorpay.</li>
              <li>Orders are confirmed only after successful payment authorization.</li>
              <li>We reserve the right to cancel any order due to unavailability, pricing errors, or suspected fraud, and will issue a full refund in such cases.</li>
              <li>Delivery charges, if any, are displayed at checkout and are non-refundable once the order is dispatched.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">4. Delivery</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Estimated delivery times are indicative and not guaranteed. Delays may occur due to traffic, weather, or operational factors.</li>
              <li>You are responsible for providing an accurate delivery address. We are not liable for non-delivery due to an incorrect address.</li>
              <li>Delivery is available only within our designated service zones. Orders placed outside these zones will be automatically cancelled and refunded.</li>
              <li>Our rider will attempt delivery once. If you are unavailable, the order may be cancelled without a refund for perishable items.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">5. Cancellations and Refunds</h2>
            <p>Please refer to our <Link href="/refund" className="text-[#FF6B35] hover:underline">Refund and Cancellation Policy</Link> for complete details on cancellations and refunds.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">6. User Accounts</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>You are responsible for maintaining the confidentiality of your account and OTPs.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>We use Firebase Authentication for secure phone-number-based login. We do not store passwords.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">7. Prohibited Conduct</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Place fraudulent orders or abuse promotional offers.</li>
              <li>Attempt to reverse-engineer, scrape, or interfere with our systems.</li>
              <li>Use the platform for any unlawful purpose.</li>
              <li>Harass, threaten, or abuse our staff, riders, or other users.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">8. Intellectual Property</h2>
            <p>All content on this platform — including logos, images, text, and software — is owned by Eigen Foods or its licensors. You may not reproduce or redistribute any content without prior written permission.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">9. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, Eigen Foods shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability to you for any claim shall not exceed the amount paid for the specific order in question.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">10. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Ranchi, Jharkhand, India. These Terms are subject to the Consumer Protection Act 2019 and the Information Technology Act 2000.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">11. Changes to Terms</h2>
            <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms. We will notify registered users of material changes via in-app notification.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">12. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:support@eigenfoods.app" className="text-[#FF6B35] hover:underline">support@eigenfoods.app</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
