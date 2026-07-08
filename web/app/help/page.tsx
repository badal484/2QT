"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, ChevronDown, ShoppingBag, CreditCard, Wallet, Bike, Star, HelpCircle, Phone, MessageCircle } from "lucide-react";

const FAQS: { category: string; icon: React.ReactNode; questions: { q: string; a: string }[] }[] = [
  {
    category: "Orders",
    icon: <ShoppingBag className="w-5 h-5" />,
    questions: [
      { q: "How do I track my order?", a: "Go to Profile → Order History and tap the active order to see real-time tracking with rider location and ETA." },
      { q: "Can I cancel my order?", a: "You can cancel within 2 minutes of placing the order, or while the status is 'Confirmed'. Once the kitchen starts preparing, cancellation is not possible. Refunds go to your 2QT Wallet." },
      { q: "What if my order is wrong or missing items?", a: "Raise a support ticket from Profile → Help & Support with category 'Order Issue'. Include your order ID for faster resolution." },
      { q: "Can I reorder a past order?", a: "Yes! Go to Profile → Order History, find a delivered order, and tap the 'Reorder' button to add those items to your cart." },
      { q: "What is the estimated delivery time?", a: "Typical delivery takes 20–40 minutes depending on your distance and kitchen load. You can see the live ETA on the order tracking screen." },
    ],
  },
  {
    category: "Payments",
    icon: <CreditCard className="w-5 h-5" />,
    questions: [
      { q: "What payment methods are accepted?", a: "We accept online payments via Razorpay (UPI, cards, net banking), 2QT Wallet, and Cash on Delivery (COD) where available." },
      { q: "My payment failed but amount was deducted — what do I do?", a: "Deducted amounts typically auto-refund within 5–7 business days. If not, contact support with the payment ID and we'll investigate immediately." },
      { q: "Can I pay using both Wallet and online payment?", a: "Yes! At checkout you can enable 'Use Wallet' to apply your wallet balance, and the remaining amount will be charged via your chosen payment method." },
      { q: "How do I get a refund?", a: "Refunds for cancelled orders go to your 2QT Wallet instantly. If you paid online and prefer a bank refund, raise a support ticket." },
    ],
  },
  {
    category: "2QT Wallet",
    icon: <Wallet className="w-5 h-5" />,
    questions: [
      { q: "How do I top up my wallet?", a: "Go to Profile → 2QT Wallet → Top Up. Choose a preset amount or enter a custom amount, then pay via Razorpay." },
      { q: "Do wallet credits expire?", a: "No, your wallet balance never expires. It stays until you use it." },
      { q: "Can I transfer wallet balance to a bank account?", a: "Currently wallet balance cannot be transferred to a bank account. It can only be used for orders on 2QT." },
    ],
  },
  {
    category: "Loyalty",
    icon: <Star className="w-5 h-5" />,
    questions: [
      { q: "How do I earn loyalty points?", a: "You earn points on every order placed. Points are credited once the order is delivered." },
      { q: "What are the loyalty tiers?", a: "Bronze (0 pts), Silver (1,000 pts), Gold (2,000 pts), Platinum (5,000 pts). Higher tiers get exclusive perks and discounts." },
      { q: "How do I redeem loyalty points?", a: "At checkout, enable 'Use Loyalty Points' to apply your points as a discount on your order." },
      { q: "Do points expire?", a: "Points expire after 6 months of account inactivity (no orders placed)." },
    ],
  },
  {
    category: "Delivery",
    icon: <Bike className="w-5 h-5" />,
    questions: [
      { q: "What are the delivery hours?", a: "We deliver based on your zone's kitchen operating hours. Typically lunch (11 AM–3 PM) and dinner (6 PM–10 PM). You'll see available items when your zone is active." },
      { q: "Is my area serviceable?", a: "Open the menu and we'll auto-detect your location. If your area isn't serviceable yet, you can submit a service request and we'll notify you when coverage expands." },
      { q: "What is the delivery fee?", a: "Delivery fees vary based on distance and are shown clearly at checkout before you confirm. Subscription plan orders may have free or reduced delivery." },
    ],
  },
  {
    category: "Meal Subscriptions",
    icon: <HelpCircle className="w-5 h-5" />,
    questions: [
      { q: "What are meal subscription plans?", a: "Subscription plans let you pre-purchase a bundle of meals (20 or 30) at a discounted per-meal rate vs ordering individually each day." },
      { q: "Can I pause my subscription?", a: "Yes! Go to the Subscription page and tap 'Pause' on your active plan. Your remaining meals are preserved and resume when you unpause." },
      { q: "What happens to unused meals?", a: "You can carry forward up to 2 unused meals per day. If you cancel a plan, unused meals are refunded to your wallet." },
      { q: "Can I have multiple active plans?", a: "Yes, you can have a lunch plan and a dinner plan active simultaneously." },
    ],
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const filtered = searchQuery.trim()
    ? FAQS.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.questions.length > 0)
    : FAQS;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-20">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/profile" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold">Help & FAQ</h1>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-10 pb-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-brand-primary" />
          </div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">How can we help?</h2>
          <p className="text-zinc-500 text-sm">Find answers to common questions below, or reach us directly.</p>
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search FAQs…"
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-zinc-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 transition-all shadow-sm"
          />
        </div>

        {/* FAQs */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p className="font-medium">No results for "{searchQuery}"</p>
            <p className="text-sm mt-1">Try a different keyword or contact support below.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map(cat => (
              <div key={cat.category} className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-100">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                    {cat.icon}
                  </div>
                  <h3 className="font-bold text-zinc-900">{cat.category}</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {cat.questions.map((item, idx) => {
                    const key = `${cat.category}-${idx}`;
                    const isOpen = openItems.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(key)}
                        className="w-full text-left px-6 py-4 hover:bg-zinc-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className={`text-sm font-semibold transition-colors ${isOpen ? "text-brand-primary" : "text-zinc-900"}`}>
                            {item.q}
                          </p>
                          <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                        {isOpen && (
                          <p className="text-sm text-zinc-500 mt-2 leading-relaxed text-left">
                            {item.a}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact support */}
        <div className="mt-10 bg-zinc-900 rounded-3xl p-8 text-white text-center">
          <h3 className="text-xl font-bold mb-2">Still need help?</h3>
          <p className="text-zinc-400 text-sm mb-6">Our support team is available during operating hours.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:+919999999999"
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all"
            >
              <Phone className="w-4 h-4" /> Call Support
            </a>
            <Link
              href="/profile?tab=support"
              className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-dark text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-brand-primary/30"
            >
              <MessageCircle className="w-4 h-4" /> Raise a Ticket
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
