"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Zap, Pause, Play, XCircle, RefreshCw } from "lucide-react";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { toast, Toaster } from "sonner";

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const reload = async () => {
    const d = await api.get("/customers/subscriptions/my");
    setActiveSubs(d.subscriptions ?? []);
  };

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login?redirect=/subscription"); return; }
    if (user) {
      api.get("/customers/subscriptions/my")
        .then(d => setActiveSubs(d.subscriptions ?? []))
        .catch(() => {})
        .finally(() => setSubsLoading(false));
      api.get("/subscriptions/plans")
        .then(d => setPlans(d.plans ?? []))
        .catch(() => setPlans([
          { id: "sub_lunch_20", name: "20 Lunch Plan", meals: 20, price_paise: 199900, type: "lunch", description: "20 gourmet lunches delivered fresh" },
          { id: "sub_lunch_30", name: "30 Lunch Plan", meals: 30, price_paise: 279900, type: "lunch", description: "30 gourmet lunches — best value" },
          { id: "sub_dinner_20", name: "20 Dinner Plan", meals: 20, price_paise: 219900, type: "dinner", description: "20 premium dinners delivered" },
          { id: "sub_dinner_30", name: "30 Dinner Plan", meals: 30, price_paise: 299900, type: "dinner", description: "30 premium dinners — best value" },
        ]))
        .finally(() => setPlansLoading(false));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handlePurchase = async (plan: any) => {
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
            await reload();
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

  const handlePause = async (subId: string) => {
    setActionLoading(subId + "_pause");
    try {
      await api.post(`/customers/subscriptions/${subId}/pause`, {});
      toast.success("Subscription paused.");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to pause");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (subId: string) => {
    setActionLoading(subId + "_resume");
    try {
      await api.post(`/customers/subscriptions/${subId}/resume`, {});
      toast.success("Subscription resumed!");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to resume");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (subId: string) => {
    if (!confirm("Cancel this subscription? Unused meals will be refunded to your wallet.")) return;
    setActionLoading(subId + "_cancel");
    try {
      await api.post(`/customers/subscriptions/${subId}/cancel`, {});
      toast.success("Subscription cancelled. Refund initiated to your wallet.");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel");
    } finally {
      setActionLoading(null);
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

        {/* Active Subscriptions */}
        {activeSubs.length > 0 && (
          <div className="mb-12 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Your Active Plans</h3>
            {activeSubs.map((sub: any) => {
              const isPaused = sub.status === "paused";
              const total = sub.total_meals ?? (sub.remaining_meals ?? 0);
              const used = total - (sub.remaining_meals ?? 0);
              const pct = total > 0 ? Math.round((used / total) * 100) : 0;
              return (
                <div key={sub.id} className={`bg-white rounded-2xl p-6 border shadow-sm ${isPaused ? "border-amber-200" : "border-green-200"}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      {isPaused
                        ? <Pause className="w-7 h-7 text-amber-500" />
                        : <CheckCircle2 className="w-7 h-7 text-green-500" />
                      }
                      <div>
                        <p className="font-bold text-zinc-900">{sub.plan_name ?? sub.plan_id?.replace("sub_", "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                        <p className="text-sm text-zinc-500">
                          {sub.remaining_meals} meals remaining
                          {isPaused && <span className="ml-2 text-amber-600 font-semibold">· Paused</span>}
                        </p>
                        {sub.current_day_credits !== undefined && (
                          <p className="text-xs text-zinc-400 mt-0.5">Today's credits: {sub.current_day_credits}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-zinc-400 font-medium">Expires</p>
                      <p className="text-sm font-semibold text-zinc-700">
                        {sub.end_date ? new Date(sub.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>{used} used</span>
                      <span>{total} total</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isPaused ? "bg-amber-400" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {isPaused ? (
                      <button
                        onClick={() => handleResume(sub.id)}
                        disabled={actionLoading === sub.id + "_resume"}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-all disabled:opacity-50"
                      >
                        {actionLoading === sub.id + "_resume" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(sub.id)}
                        disabled={actionLoading === sub.id + "_pause"}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
                      >
                        {actionLoading === sub.id + "_pause" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                        Pause
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(sub.id)}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      {actionLoading === sub.id + "_cancel" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Available Plans */}
        <h3 className="text-lg font-bold text-zinc-900 mb-6">{activeSubs.length > 0 ? "Get Another Plan" : "Choose a Plan"}</h3>

        {plansLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-72 bg-white rounded-3xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {plans.map((plan: any) => {
              const pricePaise = plan.price_paise ?? plan.pricePaise;
              const meals = plan.meals ?? plan.total_meals;
              const perMeal = Math.round(pricePaise / meals / 100);
              const isBestValue = meals >= 30;
              return (
                <div key={plan.id} className={`relative bg-white rounded-3xl border shadow-sm p-8 flex flex-col transition-all hover:shadow-md ${isBestValue ? "border-brand-primary ring-2 ring-brand-primary/20" : "border-zinc-200"}`}>
                  {isBestValue && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-black px-4 py-1 rounded-full tracking-widest uppercase shadow-md">
                      Best Value
                    </div>
                  )}
                  <div className="mb-6">
                    <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 mb-3">
                      {plan.type ?? "meal"}
                    </span>
                    <h3 className="text-2xl font-bold text-zinc-900 mb-1">{plan.name}</h3>
                    <p className="text-sm text-zinc-500">{plan.description}</p>
                  </div>

                  <div className="mb-8">
                    <div className="text-4xl font-bold text-zinc-900 mb-1">₹{pricePaise / 100}</div>
                    <div className="text-sm text-zinc-500">≈ ₹{perMeal}/meal · {meals} meals total</div>
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
        )}
      </main>
    </div>
  );
}
