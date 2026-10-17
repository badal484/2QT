import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — 2QT',
  description: 'How 2QT collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#05050A] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-[#FF6B35] text-sm hover:underline mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-base mb-3">1. Introduction</h2>
            <p>VELTO Food Palace ("Company", "we", "us") operates the 2QT food delivery platform. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use our website (go2qt.com) and mobile applications. By using our Service, you consent to the practices described here.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">2. Information We Collect</h2>
            <div className="space-y-3">
              <div>
                <p className="text-white mb-1">Information you provide:</p>
                <ul className="space-y-1 list-disc list-inside text-zinc-400">
                  <li>Phone number (used for authentication via OTP)</li>
                  <li>Name and delivery addresses</li>
                  <li>Payment information (processed securely by Razorpay — we do not store card details)</li>
                  <li>Order history and preferences</li>
                  <li>Support ticket messages and feedback</li>
                </ul>
              </div>
              <div>
                <p className="text-white mb-1">Information collected automatically:</p>
                <ul className="space-y-1 list-disc list-inside text-zinc-400">
                  <li>Device type, OS version, and app version</li>
                  <li>IP address and approximate location (for zone detection)</li>
                  <li>Precise location when you use delivery tracking (only during active orders)</li>
                  <li>Notification interaction data (sent, opened, clicked)</li>
                  <li>Crash reports and performance logs</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">3. How We Use Your Information</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>To create and manage your account</li>
              <li>To process and deliver your orders</li>
              <li>To send order status notifications via the app and WhatsApp</li>
              <li>To process payments and refunds</li>
              <li>To detect and prevent fraud</li>
              <li>To improve our products and services</li>
              <li>To send promotional communications (you can opt out at any time)</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">4. Information Sharing</h2>
            <p className="mb-2">We do not sell your personal information. We share your data only with:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li><strong className="text-zinc-300">Delivery riders:</strong> Your name, phone number (masked), and delivery address for order fulfilment.</li>
              <li><strong className="text-zinc-300">Kitchen partners:</strong> Your order details (no personal contact info) for preparation.</li>
              <li><strong className="text-zinc-300">Payment processor (Razorpay):</strong> For transaction processing, governed by Razorpay's privacy policy.</li>
              <li><strong className="text-zinc-300">Communication providers (MSG91, Interakt):</strong> Your phone number, for OTP and WhatsApp order notifications.</li>
              <li><strong className="text-zinc-300">Firebase (Google):</strong> For authentication.</li>
              <li><strong className="text-zinc-300">ImageKit:</strong> For image hosting and delivery.</li>
              <li><strong className="text-zinc-300">Law enforcement:</strong> When required by law or to protect rights and safety.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">5. Location Data</h2>
            <p>We request location permission only to detect your delivery zone during login and to enable live rider tracking during active orders. We do not track your location in the background. Precise location data is not stored beyond the duration of an order.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">6. Data Retention & Account Deletion</h2>
            <p>We retain your account data for as long as your account is active. Order records and tax invoices are retained for 7 years as mandated by Indian tax law (GST). You may delete your account and associated personal data at any time from within the 2QT app (Profile → Support → Delete Account) or by submitting an online request via our <Link href="/delete-account" className="text-[#FF6B35] hover:underline">Account Deletion Page</Link>. Online requests are processed within 30 days, subject to statutory retention requirements.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">7. Security</h2>
            <p>We use industry-standard security measures including TLS encryption in transit, hashed tokens, and role-based access controls. Payment data is handled exclusively by PCI-compliant Razorpay — we never store card details on our servers. However, no system is 100% secure and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">8. Notifications</h2>
            <p>We send in-app and WhatsApp notifications for order updates, promotions, and account activity. You can manage these preferences at any time on the app's notification preferences screen. Promotional notifications are automatically suppressed between 10pm and 8am.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">9. Your Rights</h2>
            <p className="mb-2">Under applicable Indian law (IT Act 2000, Consumer Protection Act 2019), you have the right to:</p>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data via our <Link href="/delete-account" className="text-[#FF6B35] hover:underline">Account Deletion Page</Link> or in-app</li>
              <li>Opt out of promotional communications</li>
            </ul>
            <p className="mt-2">Contact <a href="mailto:support@go2qt.com" className="text-[#FF6B35] hover:underline">support@go2qt.com</a> to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">10. Children's Privacy</h2>
            <p>Our Service is not directed at children under 18. We do not knowingly collect personal information from children. If you believe a child has provided us information, please contact us and we will delete it.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes via in-app notification. Your continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">12. Contact Us</h2>
            <p>For privacy-related queries or to exercise your rights, contact:<br />
              <strong className="text-zinc-200">VELTO Food Palace</strong><br />
              Email: <a href="mailto:support@go2qt.com" className="text-[#FF6B35] hover:underline">support@go2qt.com</a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
