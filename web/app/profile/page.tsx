"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Wallet, Star, ShoppingBag, MapPin, LogOut, ChevronRight, ArrowLeft, Edit3, Gift, Clock, Trash2, Plus, Minus, Zap, Loader2, ArrowRight, HelpCircle, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../layout";
import { api } from "../lib/api";

const TABS = [
  { id: "overview", label: "Profile", icon: User },
  { id: "orders", label: "Orders History", icon: ShoppingBag },
  { id: "wallet", label: "2QT Wallet", icon: Wallet },
  { id: "loyalty", label: "Loyalty Club", icon: Star },
  { id: "addresses", label: "Saved Places", icon: MapPin },
  { id: "support", label: "Help & Support", icon: HelpCircle },
];

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed", preparing: "Preparing", ready_for_pickup: "Ready",
  out_for_delivery: "On the Way", delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-600", preparing: "bg-amber-50 text-amber-600",
  ready_for_pickup: "bg-purple-50 text-purple-600", out_for_delivery: "bg-brand-primary/10 text-brand-primary",
  delivered: "bg-zinc-100 text-zinc-500", cancelled: "bg-red-50 text-red-600",
};

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ user, onUpdate }: { user: any; onUpdate: (u: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { 
    api.get("/customers/referrals/stats").then(setReferral); 
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const d = await api.patch("/customers/me", { name, email });
      if (d.user) { onUpdate(d.user); setEditing(false); }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const copy = () => {
    if (referral?.referralCode) { navigator.clipboard.writeText(referral.referralCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-3xl font-bold shadow-sm">
              {(user?.name ?? "U")[0].toUpperCase()}
            </div>
            <button onClick={() => setEditing(true)} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-zinc-900 border-2 border-white flex items-center justify-center text-white hover:bg-brand-primary transition-all">
               <Edit3 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left min-w-0">
            {editing ? (
              <div className="max-w-md mx-auto md:mx-0 space-y-4">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 transition-all text-zinc-900" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 transition-all text-zinc-900" />
                <div className="flex gap-3">
                  <button onClick={save} disabled={saving} className="flex-1 bg-brand-primary text-white py-3 rounded-xl text-sm font-semibold shadow-md disabled:opacity-50 hover:bg-brand-dark transition-colors">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button onClick={() => setEditing(false)} className="flex-1 bg-zinc-100 text-zinc-700 py-3 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-zinc-900 mb-2">{user?.name ?? "Guest User"}</h2>
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-zinc-500 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-brand-primary" />
                    {user?.phone}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-primary" />
                    Member Since {new Date(user?.created_at || Date.now()).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {referral && (
        <section className="bg-brand-primary rounded-3xl p-8 text-white relative overflow-hidden shadow-lg shadow-brand-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -z-0" />
          <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-xs font-bold text-white mb-6 backdrop-blur-sm border border-white/10">
                <Gift className="w-4 h-4" />
                Exclusive Offer
              </div>
              <h3 className="text-3xl font-bold tracking-tight mb-4 leading-tight">Spread the 2QT Love,<br /><span className="text-white/80">earn ₹50.</span></h3>
              <p className="text-white/80 text-sm font-medium leading-relaxed max-w-sm">
                Invite your inner circle. They get a premium first meal, and you get ₹50 in your 2QT Wallet.
              </p>
            </div>

            <div className="space-y-4">
               <div className="bg-black/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                  <div className="text-xs font-semibold text-white/80 mb-2 uppercase tracking-wider">Your Referral Code</div>
                  <div className="flex items-center gap-4">
                    <span className="flex-1 font-bold text-2xl tracking-wide">{referral.referralCode}</span>
                    <button onClick={copy} className="h-10 px-6 rounded-xl bg-white text-brand-primary text-sm font-bold shadow-md hover:scale-105 transition-all">
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
               </div>
               <div className="flex items-center gap-8 px-4 text-white">
                  <div>
                    <div className="text-xs font-medium text-white/70 mb-1 uppercase tracking-wider">Joined</div>
                    <div className="text-2xl font-bold">{referral.totalReferrals || 0}</div>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <div className="text-xs font-medium text-white/70 mb-1 uppercase tracking-wider">Earned</div>
                    <div className="text-2xl font-bold text-white">₹{(referral.rewardAmountPaise || 0) / 100}</div>
                  </div>
               </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    api.get("/orders/mine").then(d => setOrders(d.orders ?? [])).finally(() => setLoading(false)); 
  }, []);

  if (loading) return <div className="grid gap-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}</div>;
  
  if (!orders.length) return (
    <div className="bg-white rounded-3xl border border-zinc-200 p-16 text-center shadow-sm">
      <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShoppingBag className="w-10 h-10 text-brand-primary" />
      </div>
      <h3 className="text-2xl font-bold text-zinc-900 mb-3">No History Recorded</h3>
      <p className="text-zinc-500 text-sm font-medium mb-8 max-w-sm mx-auto">Your culinary journey starts at the menu. Ready to place your first order?</p>
      <Link href="/menu" className="inline-flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-xl text-sm font-semibold hover:bg-brand-dark transition-colors shadow-lg shadow-brand-primary/20">
         Discover Menu <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {orders.map((o: any) => (
        <Link key={o.id} href={`/orders/${o.id}`}>
          <motion.div whileHover={{ y: -2 }} className="bg-white rounded-2xl border border-zinc-200 p-6 flex items-center gap-6 hover:border-brand-primary/30 transition-all shadow-sm hover:shadow-md">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${o.status === "delivered" ? "bg-zinc-100 text-zinc-400" : "bg-brand-primary/10 text-brand-primary"}`}>
               <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-lg font-bold text-zinc-900">Order #{o.display_id}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status]}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-zinc-500">
                <span className="text-brand-primary font-bold">₹{o.total_amount_paise / 100}</span>
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full" />
                <span>{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </motion.div>
        </Link>
      ))}
    </div>
  );
}

// ── Wallet ────────────────────────────────────────────────────────────────────
function WalletTab() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState(500);
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    api.get("/customers/wallet").then(setWallet).finally(() => setLoading(false));
  }, []);

  const handleRecharge = async () => {
    setRecharging(true);
    try {
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          document.body.appendChild(s);
        });
      }
      const amountPaise = rechargeAmount * 100;
      const res = await api.post("/payments/wallet/recharge", { amountPaise });
      const options = {
        key: res.keyId,
        amount: res.amount,
        currency: "INR",
        name: "2QT Wallet",
        description: `Top up ₹${rechargeAmount}`,
        order_id: res.razorpayOrderId,
        handler: async (response: any) => {
          try {
            await api.post("/payments/verify-payment", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: "wallet",
              amountPaise,
            });
            const updated = await api.get("/customers/wallet");
            setWallet(updated);
          } catch (e: any) {
            console.error("Wallet recharge verification failed", e);
          }
        },
        theme: { color: "#FF6B35" },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      console.error("Recharge failed", e);
    } finally {
      setRecharging(false);
    }
  };

  if (loading) return <div className="h-64 bg-white rounded-3xl animate-pulse shadow-sm" />;
  const balance = (wallet?.balancePaise ?? 0) / 100;

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 rounded-3xl p-10 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-[100px] -z-0" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="text-center md:text-left">
              <p className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">Available Balance</p>
              <div className="text-6xl font-bold tracking-tight text-white flex items-center justify-center md:justify-start gap-2">
                 <span className="text-3xl text-brand-primary">₹</span>
                 {balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
           </div>
           <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
             <Wallet className="w-8 h-8 text-brand-primary" />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">Top Up Wallet</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          {[100, 250, 500, 1000].map(amt => (
            <button key={amt} onClick={() => setRechargeAmount(amt)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${rechargeAmount === amt ? "bg-brand-primary text-white border-brand-primary shadow-md" : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-brand-primary/40"}`}>
              ₹{amt}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <input type="number" min={100} value={rechargeAmount} onChange={e => setRechargeAmount(Number(e.target.value))}
            className="flex-1 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-primary"
            placeholder="Custom amount (min ₹100)" />
          <button onClick={handleRecharge} disabled={recharging || rechargeAmount < 100}
            className="px-6 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold shadow-md disabled:opacity-50 hover:bg-brand-dark transition-colors">
            {recharging ? "Processing..." : "Pay & Top Up"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-6">Ledger History</h3>
        {!wallet?.transactions?.length ? (
          <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-zinc-200 border-dashed">
             <p className="text-sm font-medium text-zinc-500">No activity recorded</p>
          </div>
        ) : (
          <div className="space-y-6">
            {wallet.transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.type === "credit" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                      {tx.type === "credit" ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                   </div>
                   <div>
                      <p className="font-semibold text-zinc-900">{tx.description}</p>
                      <p className="text-xs font-medium text-zinc-500 mt-1">
                        {new Date(tx.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                   </div>
                </div>
                <span className={`text-lg font-bold ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                  {tx.type === "credit" ? "+" : "-"}₹{tx.amount_paise / 100}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loyalty ───────────────────────────────────────────────────────────────────
function LoyaltyTab() {
  const [loyalty, setLoyalty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    api.get("/customers/loyalty").then(setLoyalty).finally(() => setLoading(false)); 
  }, []);

  if (loading) return <div className="h-64 bg-white rounded-3xl animate-pulse shadow-sm" />;
  const pts = loyalty?.points ?? 0;
  const tiers = [{ name: "Bronze", min: 0, color: "text-amber-700" }, { name: "Silver", min: 500, color: "text-zinc-500" }, { name: "Gold", min: 1500, color: "text-amber-500" }];
  const currentTier = [...tiers].reverse().find(t => pts >= t.min) ?? tiers[0];
  const nextTier = tiers.find(t => t.min > pts);
  const progress = nextTier ? Math.min((pts / nextTier.min) * 100, 100) : 100;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-600 mb-4">
              <Star className="w-4 h-4 fill-current" />
              2QT Elite Club
            </div>
            <div className="text-6xl font-bold tracking-tight text-zinc-900 mb-2 flex items-baseline justify-center md:justify-start gap-2">
               {pts.toLocaleString()} 
               <span className="text-xl text-zinc-500 font-medium">PTS</span>
            </div>
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
               TIER STATUS: <span className={currentTier.color}>{currentTier.name}</span>
            </p>
          </div>

          <div className="w-full md:w-96">
             {nextTier ? (
               <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
                  <div className="flex justify-between text-xs font-bold text-zinc-600 mb-4 uppercase tracking-wider">
                    <span>Unlock {nextTier.name} Status</span>
                    <span className="text-amber-600">{nextTier.min - pts} pts left</span>
                  </div>
                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mb-4">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.5 }} className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500 leading-relaxed">
                    You're ascending. Next tier unlocks complimentary delivery and priority execution.
                  </p>
               </div>
             ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                   <Star className="w-10 h-10 text-amber-500 fill-amber-500 mx-auto mb-3" />
                   <h4 className="text-amber-800 font-bold mb-1">Maximum Tier Reached</h4>
                   <p className="text-amber-700/80 text-sm font-medium">You are a true connoisseur.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Addresses ─────────────────────────────────────────────────────────────────
function AddressesTab() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "Home", addressText: "" });
  const [saving, setSaving] = useState(false);
  const [zoneId, setZoneId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get("/customers/addresses");
      setAddresses(d.addresses ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get("/menu/zones/check?lat=12.9716&lng=77.5946").then(d => { if (d.serviceable) setZoneId(d.zone.id); });
  }, [load]);

  const del = async (id: string) => { 
    await api.delete(`/customers/addresses/${id}`); 
    load(); 
  };

  const add = async () => {
    if (!form.addressText || !zoneId) return;
    setSaving(true);
    try {
      await api.post("/customers/addresses", { ...form, lat: 12.9716, lng: 77.5946, zoneId });
      setShowForm(false);
      setForm({ label: "Home", addressText: "" });
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid gap-6">{[1,2].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}</div>;

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 gap-6">
        {addresses.map((a: any) => (
          <div key={a.id} className="bg-white rounded-3xl border border-zinc-200 p-6 flex items-start gap-4 hover:border-brand-primary/30 transition-all group relative shadow-sm">
            <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 text-brand-primary">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-zinc-900">{a.label}</p>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed mt-1 line-clamp-2">{a.address_text}</p>
            </div>
            <button onClick={() => del(a.id)} className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
        
        <button onClick={() => setShowForm(true)}
          className="h-full min-h-[120px] border-2 border-dashed border-zinc-300 rounded-3xl flex flex-col items-center justify-center gap-2 group hover:border-brand-primary hover:bg-brand-primary/5 transition-all bg-zinc-50">
          <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-all text-zinc-500">
             <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm font-semibold text-zinc-500 group-hover:text-brand-primary transition-all">Add New Location</span>
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-lg">
            <h3 className="text-2xl font-bold mb-6 text-zinc-900">Set Delivery Destination</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                {["Home", "Work", "Office", "Other"].map(l => (
                   <button key={l} onClick={() => setForm({ ...form, label: l })} className={`py-3 rounded-xl text-sm font-bold transition-all ${form.label === l ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                      {l}
                   </button>
                ))}
              </div>
              <textarea value={form.addressText} onChange={e => setForm({ ...form, addressText: e.target.value })}
                placeholder="Enter complete address details..." className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 px-5 text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 transition-all h-28 resize-none text-zinc-900" />
              <div className="flex gap-3">
                <button onClick={add} disabled={saving || !form.addressText}
                  className="flex-1 bg-brand-primary text-white py-4 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-md hover:bg-brand-dark">
                  {saving ? "Saving..." : "Confirm Location"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-8 py-4 rounded-xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Support ───────────────────────────────────────────────────────────────────
function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = () => {
    api.get("/customers/support/tickets")
      .then(d => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTickets(); }, []);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/customers/support/tickets", { subject: subject.trim(), message: message.trim() });
      setSubject("");
      setMessage("");
      loadTickets();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    open: "bg-amber-50 text-amber-600 border-amber-200",
    resolved: "bg-green-50 text-green-600 border-green-200",
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-6">Submit a Request</h3>
        <div className="space-y-4">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject (e.g. Wrong item delivered)"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 text-zinc-900"
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe your issue in detail..."
            rows={4}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 text-zinc-900 resize-none"
          />
          <button
            onClick={submit}
            disabled={submitting || !subject.trim() || !message.trim()}
            className="flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-brand-dark transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Sending..." : "Submit Ticket"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-6">My Tickets</h3>
        {loading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 bg-zinc-100 rounded-2xl animate-pulse" />)}</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-200 border-dashed">
            <HelpCircle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500">No support tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t: any) => (
              <div key={t.id} className="border border-zinc-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-zinc-900">{t.subject}</p>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[t.status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>
                    {t.status === "resolved" ? "Resolved" : "Open"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mb-2">{t.message}</p>
                {t.status === "resolved" && t.resolution && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <p className="text-xs font-bold text-green-700 mb-1">Support Response</p>
                    <p className="text-sm text-green-800">{t.resolution}</p>
                  </div>
                )}
                <p className="text-xs text-zinc-400 mt-2">
                  {new Date(t.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function ProfileContent() {
  const { user, logout, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "overview");
  const [profile, setProfile] = useState<any>(user);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) {
      setProfile((prev: any) => prev ?? user);
      api.get("/customers/me").then(d => { if (d.user) setProfile(d.user); }).catch(() => {});
    }
  }, [user, authLoading, router]);

  if (authLoading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
    </div>
  );
  if (!user) return null;

  const PANELS: Record<string, React.ReactNode> = {
    overview: <OverviewTab user={profile} onUpdate={setProfile} />,
    orders: <OrdersTab />,
    wallet: <WalletTab />,
    loyalty: <LoyaltyTab />,
    addresses: <AddressesTab />,
    support: <SupportTab />,
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-brand-primary/20">
      <nav className="fixed top-0 w-full z-[100] px-6 py-4 backdrop-blur-2xl bg-white/80 border-b border-black/5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/menu" className="text-2xl font-bold tracking-tight shrink-0 flex items-center gap-2 group">
             <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-brand-primary transition-colors" />
             2QT<span className="text-brand-primary">.</span>
          </Link>
          <button onClick={() => { logout(); router.push("/"); }} className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all text-zinc-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-32 pb-24 flex flex-col md:flex-row gap-12">
        <aside className="md:w-64 shrink-0">
          <div className="space-y-2 sticky top-32">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-semibold transition-all ${
                  tab === t.id 
                  ? "bg-zinc-900 text-white shadow-md shadow-black/10" 
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50"
                }`}>
                <t.icon className={`w-5 h-5 ${tab === t.id ? "text-white" : ""}`} />
                {t.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {PANELS[tab]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
