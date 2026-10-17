'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function DeleteAccountPage() {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number registered with 2QT.');
      return;
    }

    if (!confirmed) {
      setError('Please acknowledge the terms of data deletion and retention.');
      return;
    }

    const subject = encodeURIComponent(`Account Deletion Request: +91 ${cleanPhone}`);
    const body = encodeURIComponent(
      `Hello 2QT Support Team,\n\nI am requesting permanent deletion of my 2QT account and associated personal data.\n\n` +
      `Registered Mobile Number: +91 ${cleanPhone}\n` +
      `Reason for Deletion: ${reason.trim() || 'Not specified'}\n\n` +
      `I understand that personal data (name, phone, email, saved addresses) will be deleted or anonymized, and that tax/order transaction records will be retained for legal compliance as required by Indian law (GST).\n\n` +
      `Thank you.`
    );

    window.location.href = `mailto:support@go2qt.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#05050A] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-[#FF6B35] text-sm hover:underline mb-8 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Request Account & Data Deletion</h1>
        <p className="text-zinc-500 text-sm mb-10">
          In accordance with Google Play Developer Policies and applicable data protection regulations.
        </p>

        {submitted ? (
          <div className="p-8 rounded-2xl bg-zinc-900/60 border border-emerald-500/30 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <h2 className="text-xl font-semibold text-white">Deletion Request Initiated</h2>
            <p className="text-zinc-300 text-sm max-w-lg mx-auto">
              Your deletion request for mobile number <strong className="text-white">+91 {phone.replace(/\D/g, '')}</strong> has been prepared for <span className="text-[#FF6B35]">support@go2qt.com</span>.
            </p>
            <p className="text-zinc-400 text-xs max-w-lg mx-auto">
              Our privacy operations team will verify your phone number via SMS/call and complete personal data deletion within 30 days. You will receive an SMS confirmation once completed.
            </p>
            <div className="pt-4">
              <Link href="/" className="text-sm text-[#FF6B35] hover:underline">
                Return to 2QT Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8 text-sm leading-relaxed">
            <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold text-base">How to Delete Your Account</h2>
              <div className="space-y-3 text-zinc-400 text-sm">
                <p>
                  You can delete your 2QT account through either of two methods:
                </p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    <strong className="text-zinc-200">Inside the Mobile App:</strong> Open the 2QT app → Navigate to <span className="text-white">Profile</span> → Scroll to <span className="text-white">Support</span> → Tap <span className="text-red-400">Delete Account</span> → Confirm deletion. Deletion takes effect immediately.
                  </li>
                  <li>
                    <strong className="text-zinc-200">Via This Web Form:</strong> If you have uninstalled the app or cannot access your device, submit your registered mobile number below. Our support team will verify your identity and process deletion within 30 days.
                  </li>
                </ol>
              </div>
            </section>

            <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold text-base">Data Retention & Deletion Disclosures</h2>
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 space-y-2">
                  <h3 className="font-semibold text-red-300 text-sm">What Will Be Deleted Immediately:</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400">
                    <li>Your full name and profile avatar</li>
                    <li>Registered phone number and email</li>
                    <li>All saved delivery addresses</li>
                    <li>Active push notification tokens</li>
                    <li>Unused wallet balances & loyalty points (forfeited)</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-2">
                  <h3 className="font-semibold text-amber-300 text-sm">What Data Is Retained by Law:</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400">
                    <li>Financial transaction and payment IDs</li>
                    <li>Order invoices and GST tax audit records</li>
                    <li>Retention period: 7 years as mandated by the Indian Central Goods and Services Tax (CGST) Act, 2017</li>
                  </ul>
                </div>
              </div>
            </section>

            <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
              <h2 className="text-white font-semibold text-base">Submit Web Deletion Request</h2>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Registered 10-Digit Mobile Number *
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-zinc-800 text-zinc-400 border border-r-0 border-zinc-700 rounded-l-xl text-sm font-medium">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-r-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Reason for Leaving (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Help us improve: why would you like to delete your account?"
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]"
                />
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirm"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 accent-[#FF6B35] rounded"
                />
                <label htmlFor="confirm" className="text-xs text-zinc-400">
                  I understand that this action is permanent. My personal details, phone number, and delivery addresses will be deleted, and any unused wallet balances will be forfeited. Historical invoices are retained for statutory tax compliance.
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
              >
                Submit Account Deletion Request
              </button>
            </form>

            <section className="text-xs text-zinc-500 pt-4">
              <p>
                Have questions or need assistance? Review our{' '}
                <Link href="/privacy" className="text-[#FF6B35] hover:underline">
                  Privacy Policy
                </Link>{' '}
                or email{' '}
                <a href="mailto:support@go2qt.com" className="text-zinc-400 hover:underline">
                  support@go2qt.com
                </a>
                .
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
