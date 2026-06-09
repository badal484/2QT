"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { toast, Toaster } from "sonner";

const PLANS = [
  { id: "sub_lunch_20", name: "20 Lunch Plan", meals: 20, pricePaise: 199900, type: "lunch", description: "20 gourmet lunches delivered fresh" },
  { id: "sub_lunch_30", name: "30 Lunch Plan", meals: 30, pricePaise: 279900, type: "lunch", description: "30 gourmet lunches — best value" },
  { id: "sub_dinner_20", name: "20 Dinner Plan", meals: 20, pricePaise: 219900, type: "dinner", description: "20 premium dinners delivered" },
  { id: "sub_dinner_30", name: "30 Dinner Plan", meals: 30, pricePaise: 299900, type: "dinner", description: "30 premium dinners — best value" },
];

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login?redirect=/subscription"); return; }
    if (user) {
      api.get("/customers/subscriptions/my")
        .then(d => setActiveSubs(d.subscriptions ?? []))
        .catch(() => {})
        .finally(() => setSubsLoading(false));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handlePurchase = async (plan: typeof PLANS[0]) => {
    if (!user) { router.push("/login"); return; }
    setPurchasing(plan.id);
    try {
      const res = await api.post("/payments/subscription/purchase", { planId: plan.id });
      const options = {
        key: res.keyId,
        amount: res.amount,
        currency: "INR",
        name: "2QT Subscription",
        description: plan.name,
        order_id: res.razorpayOrderId,
        handler: async (response: any) => {
          try {
            await api.post("/payments/verify-payment", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: "subscription",
              planId: plan.id,
            });
            toast.success(`${plan.name} activated! Enjoy your meals.`);
            const d = await api.get("/customers/subscriptions/my");
            setActiveSubs(d.subscriptions ?? []);
          } catch (e: any) {
            toast.error("Payment verification failed: " + e.message);
          }
        },
        theme: { color: "#FF6B35" },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || "Failed to initiate purchase");
    } finally {
      setPurchasing(null);
    }
  };

  if (authLoading || subsLoading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-20">
      <Toaster richColors position="top-center" />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/menu" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Menu
          </Link>
          <h1 className="text-lg font-bold">2QT Meal Plans</h1>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-12 pb-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-bold mb-4">
            <Zap className="w-4 h-4" /> Save up to 30% vs ordering daily
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-3">Meal Subscriptions</h2>
          <p className="text-zinc-500 max-w-md mx-auto">Pre-pay for a bundle of meals and enjoy priority delivery and exclusive pricing.</p>
        </div>

        {activeSubs.length > 0 && (
          <div className="mb-10 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Your Active Plans</h3>
            {activeSubs.map((sub: any) => (
              <div key={sub.id} className="bg-white border border-green-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-bold text-zinc-900">{sub.plan_id?.replace("sub_", "").replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                    <p className="text-sm text-zinc-500">{sub.remaining_meals} meals remaining</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400 font-medium">Expires</p>
                  <p className="text-sm font-semibold text-zinc-700">{new Date(sub.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PLANS.map(plan => {
            const perMeal = Math.round(plan.pricePaise / plan.meals / 100);
            const isBestValue = plan.meals === 30;
            return (
              <div key={plan.id} className={`relative bg-white rounded-3xl border shadow-sm p-8 flex flex-col transition-all hover:shadow-md ${isBestValue ? "border-brand-primary ring-2 ring-brand-primary/20" : "border-zinc-200"}`}>
                {isBestValue && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-black px-4 py-1 rounded-full tracking-widest uppercase shadow-md">
                    Best Value
                  </div>
                )}
                <div className="mb-6">
                  <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 mb-3">
                    {plan.type}
                  </span>
                  <h3 className="text-2xl font-bold text-zinc-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-zinc-500">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <div className="text-4xl font-bold text-zinc-900 mb-1">₹{plan.pricePaise / 100}</div>
                  <div className="text-sm text-zinc-500">≈ ₹{perMeal}/meal · {plan.meals} meals total</div>
                </div>

                <ul className="space-y-2 mb-8 flex-1">
                  {["Priority delivery", "Skip the queue", "Free delivery on subscription orders", "Carry forward unused meals (up to 2)"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(plan)}
                  disabled={!!purchasing}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 ${isBestValue ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-dark" : "bg-zinc-900 text-white hover:bg-black shadow-md"}`}
                >
                  {purchasing === plan.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Buy ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
