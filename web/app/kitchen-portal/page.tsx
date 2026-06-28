"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Wallet, IndianRupee, LogOut, RefreshCw,
  Utensils, Clock, CheckCircle2, BarChart3, ChevronRight, X
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const fmt = (paise: number | string) =>
  `₹${(parseInt(String(paise || 0)) / 100).toLocaleString("en-IN")}`;
const pct = (r: number | string) =>
  `${(parseFloat(String(r || 0)) * 100).toFixed(0)}%`;

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: any, token: string, refresh: string) => void }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Enter a valid phone number");
    setLoading(true);
    try {
      await api.sendOtp(digits);
      setStep("otp");
      toast.success("OTP sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const res = await api.verifyOtp(digits, otp, undefined);
      if (!res.user || !["partner_kitchen", "super_admin"].includes(res.user.role)) {
        toast.error("Access denied. Partner kitchen credentials required.");
        return;
      }
      onLogin(res.user, res.accessToken, res.refreshToken);
      toast.success(`Welcome back!`);
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#07070e] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-black text-white leading-none">2QT<span className="text-[#F97316]">.</span></div>
            <div className="text-xs text-white/30 font-semibold mt-0.5">Partner Kitchen Portal</div>
          </div>
        </div>

        <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-black text-white">{step === "phone" ? "Sign in" : "Verify OTP"}</h1>
            <p className="text-white/30 text-sm mt-1">
              {step === "phone" ? "Partner kitchen access only" : `Code sent to ${phone}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.form key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={sendOTP} className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210"
                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
                </div>
                <button type="submit" disabled={loading || phone.replace(/\D/g, "").length < 10}
                  className="w-full py-3.5 rounded-xl bg-[#F97316] text-white font-black text-sm hover:bg-[#ea6c08] transition-colors disabled:opacity-40">
                  {loading ? "Sending..." : "Send OTP"}
                </button>
              </motion.form>
            ) : (
              <motion.form key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={verifyOTP} className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">OTP Code</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="• • • • • •"
                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20 tracking-[0.4em] text-center font-mono text-lg" />
                </div>
                <button type="submit" disabled={loading || otp.length < 4}
                  className="w-full py-3.5 rounded-xl bg-[#F97316] text-white font-black text-sm hover:bg-[#ea6c08] transition-colors disabled:opacity-40">
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>
                <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} className="w-full text-xs text-white/30 hover:text-white/60 transition-colors">
                  ← Change number
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        <p className="text-center text-xs text-white/20 mt-6">2QT Partner Kitchen Portal · Restricted Access</p>
      </motion.div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, netPaise, grossPaise, commissionPaise, orders, accent = false }: any) {
  return (
    <div className={`rounded-2xl p-5 border space-y-3 ${accent
      ? "bg-[#F97316]/10 border-[#F97316]/20"
      : "bg-[#0d0d1a] border-white/[0.07]"
    }`}>
      <div className={`text-xs font-bold uppercase tracking-widest ${accent ? "text-[#F97316]" : "text-white/40"}`}>{label}</div>
      <div className={`text-3xl font-black tracking-tight ${accent ? "text-[#F97316]" : "text-white"}`}>
        {fmt(netPaise)}
      </div>
      <div className="space-y-1.5 pt-1 border-t border-white/[0.05]">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Gross sales</span>
          <span className="text-white/60 font-semibold">{fmt(grossPaise)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">2QT commission</span>
          <span className="text-red-400 font-semibold">−{fmt(commissionPaise)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Orders</span>
          <span className="text-white/60 font-semibold">{orders}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: any }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] rounded-xl transition-colors">
      <div>
        <div className="text-xs font-mono text-white/60">#{order.display_id}</div>
        <div className="text-xs text-white/30 mt-0.5">
          {new Date(order.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          {" · "}<span className="capitalize">{order.payment_method}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-black text-emerald-400">{fmt(order.kitchen_payout_paise)}</div>
        <div className="text-[10px] text-white/30">−{fmt(order.commission_paise)} commission</div>
      </div>
    </div>
  );
}

// ─── Payout Row ──────────────────────────────────────────────────────────────

function PayoutRow({ payout }: { payout: any }) {
  const isPaid = payout.status === "paid";
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] rounded-xl transition-colors">
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPaid
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-amber-500/15 text-amber-400"
          }`}>
            {isPaid ? "PAID" : "PENDING"}
          </span>
          <span className="text-xs text-white/40 font-mono">
            {new Date(payout.period_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {" – "}
            {new Date(payout.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </div>
        {isPaid && payout.upi_reference && (
          <div className="text-[10px] text-white/20 mt-0.5 font-mono">Ref: {payout.upi_reference}</div>
        )}
      </div>
      <div className="text-right">
        <div className={`text-base font-black ${isPaid ? "text-emerald-400" : "text-amber-400"}`}>
          {fmt(payout.net_payout_paise)}
        </div>
        <div className="text-[10px] text-white/30">
          Gross {fmt(payout.gross_sales_paise)} − {fmt(payout.commission_paise)}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"earnings" | "orders" | "payouts">("earnings");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/kitchen/my-earnings");
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load earnings");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["menu_updated", "inventory_updated", "kitchen_metrics_updated", "kitchen_payout_updated", "new_order"], load);

  const kitchen = data?.kitchen;
  const commissionRate = parseFloat(kitchen?.commission_rate || "0.20");

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans">
      {/* Header */}
      <header className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between bg-[#0a0a14] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center">
            <Utensils className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-black text-white leading-none">
              {kitchen?.name || "My Kitchen"}
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">Partner Portal · {pct(commissionRate)} commission rate</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Commission explainer */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F97316]/15 flex items-center justify-center shrink-0 mt-0.5">
            <IndianRupee className="w-4 h-4 text-[#F97316]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">How your earnings work</div>
            <div className="text-xs text-white/40 mt-1 leading-relaxed">
              For every order: <span className="text-white/70">Customer pays ₹100 → 2QT takes {pct(commissionRate)} commission (₹{(commissionRate * 100).toFixed(0)}) → You receive ₹{(100 - commissionRate * 100).toFixed(0)}.</span>
              {" "}Delivery fee goes to 2QT. You get paid weekly to your UPI ID: <span className="font-mono text-[#F97316]">{kitchen?.upi_id || "—"}</span>
            </div>
          </div>
        </div>

        {/* Section nav */}
        <div className="flex gap-2">
          {(["earnings", "orders", "payouts"] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeSection === s
                  ? "bg-[#F97316] text-white"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-white/[0.03] rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeSection === "earnings" && (
              <motion.div key="earnings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="Today"
                    netPaise={data?.today?.net}
                    grossPaise={data?.today?.gross}
                    commissionPaise={data?.today?.commission}
                    orders={data?.today?.orders}
                  />
                  <StatCard
                    label="This Week"
                    netPaise={data?.thisWeek?.net}
                    grossPaise={data?.thisWeek?.gross}
                    commissionPaise={data?.thisWeek?.commission}
                    orders={data?.thisWeek?.orders}
                    accent
                  />
                  <StatCard
                    label="This Month"
                    netPaise={data?.thisMonth?.net}
                    grossPaise={data?.thisMonth?.gross}
                    commissionPaise={data?.thisMonth?.commission}
                    orders={data?.thisMonth?.orders}
                  />
                  <StatCard
                    label="All Time"
                    netPaise={data?.allTime?.net}
                    grossPaise={data?.allTime?.gross}
                    commissionPaise={data?.allTime?.commission}
                    orders={data?.allTime?.orders}
                  />
                </div>

                {/* Next payout estimate */}
                {data?.thisWeek?.net > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Next Payout Estimate</div>
                      <div className="text-xs text-white/40 mt-0.5">Based on this week's completed orders</div>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{fmt(data?.thisWeek?.net)}</div>
                  </div>
                )}
              </motion.div>
            )}

            {activeSection === "orders" && (
              <motion.div key="orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Recent Orders</span>
                    <span className="text-xs text-white/30">{data?.recentOrders?.length || 0} shown</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {data?.recentOrders?.length > 0
                      ? data.recentOrders.map((o: any) => <OrderRow key={o.display_id} order={o} />)
                      : <div className="py-12 text-center text-white/30 text-sm">No delivered orders yet</div>
                    }
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "payouts" && (
              <motion.div key="payouts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.05]">
                    <div className="text-sm font-bold text-white">Payout History</div>
                    <div className="text-xs text-white/30 mt-0.5">Generated weekly by 2QT finance team. Paid to: <span className="font-mono text-[#F97316]">{kitchen?.upi_id || "—"}</span></div>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {data?.payouts?.length > 0
                      ? data.payouts.map((p: any) => <PayoutRow key={p.id} payout={p} />)
                      : <div className="py-12 text-center text-white/30 text-sm">No payouts yet — first payout after first full week</div>
                    }
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KitchenPortalPage() {
  const [user, setUser] = useState<any>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem("2qt_kitchen_token");
      const stored = localStorage.getItem("2qt_kitchen_user");
      if (token && stored) {
        localStorage.setItem("2qt_token", token);
        setUser(JSON.parse(stored));
      }
    } catch {}
    setBooted(true);
  }, []);

  const handleLogin = (userData: any, token: string, refresh: string) => {
    try {
      localStorage.setItem("2qt_kitchen_token", token);
      localStorage.setItem("2qt_kitchen_refresh_token", refresh);
      localStorage.setItem("2qt_kitchen_user", JSON.stringify(userData));
      // Also set main token so api client works
      localStorage.setItem("2qt_token", token);
      localStorage.setItem("2qt_refresh_token", refresh);
    } catch {}
    setUser(userData);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("2qt_kitchen_token");
      localStorage.removeItem("2qt_kitchen_refresh_token");
      localStorage.removeItem("2qt_kitchen_user");
      localStorage.removeItem("2qt_token");
      localStorage.removeItem("2qt_refresh_token");
    } catch {}
    setUser(null);
    toast.success("Signed out");
  };

  if (!booted) {
    return (
      <div className="min-h-screen bg-[#07070e] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
