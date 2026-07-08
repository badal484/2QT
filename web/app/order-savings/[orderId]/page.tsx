"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Tag, Wallet, Star, Sparkles, Share2 } from "lucide-react";

interface SavingsData {
  subtotalPaise: number;
  discountPaise: number;
  walletDeductionPaise: number;
  loyaltyDiscountPaise: number;
  deliveryFeePaise: number;
  totalAmountPaise: number;
  promoCode?: string;
}

export default function OrderSavingsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [savings, setSavings] = useState<SavingsData | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`2qt_savings_${orderId}`);
      if (raw) {
        setSavings(JSON.parse(raw));
        sessionStorage.removeItem(`2qt_savings_${orderId}`);
      }
    } catch {}
  }, [orderId]);

  const totalSavedPaise = savings
    ? (savings.discountPaise || 0) + (savings.walletDeductionPaise || 0) + (savings.loyaltyDiscountPaise || 0)
    : 0;

  const subtotal = savings?.subtotalPaise ?? 0;
  const pctSaved = subtotal > 0 ? Math.round((totalSavedPaise / subtotal) * 100) : 0;

  const lines = savings ? [
    savings.discountPaise > 0 && {
      icon: <Tag className="w-4 h-4 text-green-600" />,
      label: savings.promoCode ? `Promo Code (${savings.promoCode})` : "Promo Discount",
      amount: savings.discountPaise,
      color: "text-green-600",
    },
    savings.loyaltyDiscountPaise > 0 && {
      icon: <Star className="w-4 h-4 text-amber-500" />,
      label: "Loyalty Points",
      amount: savings.loyaltyDiscountPaise,
      color: "text-amber-600",
    },
    savings.walletDeductionPaise > 0 && {
      icon: <Wallet className="w-4 h-4 text-blue-600" />,
      label: "2QT Wallet",
      amount: savings.walletDeductionPaise,
      color: "text-blue-600",
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; amount: number; color: string }[] : [];

  const handleShare = async () => {
    const text = `I just saved ₹${totalSavedPaise / 100} on my 2QT order! 🎉 Order food at 2QT and save big.`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Success icon */}
        <div className="relative w-28 h-28 mx-auto mb-8">
          <div className="w-28 h-28 rounded-[36px] bg-brand-primary flex items-center justify-center shadow-2xl shadow-brand-primary/40">
            <CheckCircle2 className="w-14 h-14 text-white" />
          </div>
          {totalSavedPaise > 0 && (
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Order Confirmed!</h1>
        <p className="text-zinc-500 text-sm mb-8">Your gourmet meal is being prepared with care.</p>

        {/* Savings card */}
        {totalSavedPaise > 0 && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm mb-6 text-left">
            <div className="text-center mb-5">
              <p className="text-sm text-zinc-500 mb-1">You saved</p>
              <p className="text-4xl font-black text-green-600">₹{totalSavedPaise / 100}</p>
              {pctSaved > 0 && (
                <p className="text-sm text-zinc-400 mt-1">That's {pctSaved}% off your order total!</p>
              )}
            </div>

            <div className="space-y-3 divide-y divide-zinc-100">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between pt-3 first:pt-0">
                  <div className="flex items-center gap-2">
                    {line.icon}
                    <span className="text-sm font-medium text-zinc-700">{line.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${line.color}`}>-₹{line.amount / 100}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalSavedPaise === 0 && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm mb-6">
            <p className="text-sm text-zinc-500">Use promo codes, wallet, and loyalty points next time to save more!</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href={`/orders/${orderId}`}
            className="flex items-center justify-center gap-2 w-full bg-brand-primary text-white py-4 rounded-2xl text-sm font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/25"
          >
            Track Order <ChevronRight className="w-4 h-4" />
          </Link>

          {totalSavedPaise > 0 && (
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 w-full bg-white border border-zinc-200 text-zinc-700 py-4 rounded-2xl text-sm font-bold hover:bg-zinc-50 transition-all"
            >
              <Share2 className="w-4 h-4" /> Share your savings
            </button>
          )}

          <Link
            href="/menu"
            className="block text-sm font-semibold text-zinc-400 hover:text-zinc-600 transition-colors py-2"
          >
            Back to Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
