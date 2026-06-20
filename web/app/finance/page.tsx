"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Wallet, Bike, Utensils, Receipt,
  BarChart3, LogOut, IndianRupee, Menu, X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const OverviewTab = dynamic(() => import("./OverviewTab").then(m => ({ default: m.OverviewTab })), { ssr: false });
const CODTab = dynamic(() => import("./CODTab").then(m => ({ default: m.CODTab })), { ssr: false });
const RiderPayoutsTab = dynamic(() => import("./RiderPayoutsTab").then(m => ({ default: m.RiderPayoutsTab })), { ssr: false });
const KitchenPayoutsTab = dynamic(() => import("./KitchenPayoutsTab").then(m => ({ default: m.KitchenPayoutsTab })), { ssr: false });
const TransactionsTab = dynamic(() => import("./TransactionsTab").then(m => ({ default: m.TransactionsTab })), { ssr: false });
const ProductsTab = dynamic(() => import("./ProductsTab").then(m => ({ default: m.ProductsTab })), { ssr: false });
const TABS = [
  { name: "Overview", icon: LayoutDashboard, component: OverviewTab, section: "Main" },
  { name: "COD Cash", icon: Wallet, component: CODTab, section: "Main" },
  { name: "Rider Payouts", icon: Bike, component: RiderPayoutsTab, section: "Payouts" },
  { name: "Kitchen Payouts", icon: Utensils, component: KitchenPayoutsTab, section: "Payouts" },
  { name: "Transactions", icon: Receipt, component: TransactionsTab, section: "Reports" },
  { name: "Products", icon: BarChart3, component: ProductsTab, section: "Reports" },
];

const SECTIONS = ["Main", "Payouts", "Reports"];

// ─── Login ────────────────────────────────────────────────────────────────────
// Uses the same phone+OTP system as the rest of the app.
// Finance users are created by admin via the Team tab (phone number only, no password).

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
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const res = await api.verifyOtp(digits, otp, undefined);
      if (!res.user || !["finance", "super_admin"].includes(res.user.role)) {
        toast.error("Access denied. Finance team credentials required.");
        return;
      }
      onLogin(res.user, res.accessToken, res.refreshToken);
      toast.success(`Welcome, ${res.user.name}`);
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070e] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-black text-white leading-none">
              2QT<span className="text-emerald-400">.</span>
            </div>
            <div className="text-xs text-white/30 font-semibold mt-0.5">Finance Portal</div>
          </div>
        </div>

        <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-black text-white">{step === "phone" ? "Sign in" : "Verify OTP"}</h1>
            <p className="text-white/30 text-sm mt-1">
              {step === "phone" ? "Finance team access only" : `Code sent to ${phone}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={sendOTP} className="space-y-4">
              <div>
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9876543210"
                  autoComplete="tel"
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/20"
                />
              </div>
              <button type="submit" disabled={loading || phone.replace(/\D/g,"").length < 10}
                className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-400 transition-colors disabled:opacity-40">
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </motion.form>
          ) : (
            <motion.form key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={verifyOTP} className="space-y-4">
              <div>
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  autoComplete="one-time-code"
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/20 tracking-[0.4em] text-center font-mono text-lg"
                />
              </div>
              <button type="submit" disabled={loading || otp.length < 4}
                className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-400 transition-colors disabled:opacity-40">
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} className="w-full text-xs text-white/30 hover:text-white/60 transition-colors">
                ← Change number
              </button>
            </motion.form>
          )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          2QT Finance Portal · Restricted Access
        </p>
      </motion.div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function FinancePage() {
  const { user, loading, login, logout } = useAuth()!;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLocalLogin = (userData: any, token: string, refresh: string) => {
    try {
      localStorage.setItem("2qt_token", token);
      localStorage.setItem("2qt_refresh_token", refresh);
    } catch {}
    login(userData);
  };

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
  };

  const isFinanceUser = user && ["finance", "super_admin"].includes(user.role);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isFinanceUser) {
    return <LoginScreen onLogin={handleLocalLogin} />;
  }

  const ActiveComponent = TABS.find(t => t.name === activeTab)?.component ?? OverviewTab;

  return (
    <div className="min-h-screen bg-[#07070e] flex font-sans selection:bg-emerald-500/30">
      {/* ── Sidebar (desktop) ── */}
      <aside className="w-[220px] bg-[#0a0a14] border-r border-white/[0.05] flex flex-col sticky top-0 h-screen z-20 shrink-0 hidden lg:flex">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-white leading-none">
                2QT<span className="text-emerald-400">.</span>
              </div>
              <div className="text-[10px] text-white/30 font-semibold mt-0.5 uppercase tracking-wider">Finance</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {SECTIONS.map(section => {
            const sectionTabs = TABS.filter(t => t.section === section);
            return (
              <div key={section}>
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-2 mb-1.5">{section}</div>
                <div className="space-y-0.5">
                  {sectionTabs.map(tab => {
                    const active = activeTab === tab.name;
                    return (
                      <button
                        key={tab.name}
                        onClick={() => setActiveTab(tab.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "text-white/40 hover:text-white/80 hover:bg-white/5"
                        }`}
                      >
                        <tab.icon className={`w-4 h-4 shrink-0 ${active ? "text-emerald-400" : "text-white/30"}`} />
                        {tab.name}
                        {active && (
                          <motion.div
                            layoutId="sidebar-pill"
                            className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/[0.05]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xs">
              {user.name?.[0]?.toUpperCase() || "F"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white/80 truncate">{user.name}</div>
              <div className="text-[10px] text-white/30 capitalize">{user.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile nav overlay ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            />
            <motion.aside
              initial={{ x: -220 }}
              animate={{ x: 0 }}
              exit={{ x: -220 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 w-[220px] h-screen bg-[#0a0a14] border-r border-white/[0.05] flex flex-col z-40 lg:hidden"
            >
              <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <IndianRupee className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="text-base font-black text-white">2QT<span className="text-emerald-400">.</span> Finance</div>
                </div>
                <button onClick={() => setMobileNavOpen(false)} className="text-white/40">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
                {SECTIONS.map(section => {
                  const sectionTabs = TABS.filter(t => t.section === section);
                  return (
                    <div key={section}>
                      <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-2 mb-1.5">{section}</div>
                      <div className="space-y-0.5">
                        {sectionTabs.map(tab => {
                          const active = activeTab === tab.name;
                          return (
                            <button key={tab.name}
                              onClick={() => { setActiveTab(tab.name); setMobileNavOpen(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                active ? "bg-emerald-500/15 text-emerald-400" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                              }`}>
                              <tab.icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-white/30"}`} />
                              {tab.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
              <div className="px-4 py-4 border-t border-white/[0.05]">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-[#0a0a14] sticky top-0 z-10">
          <button onClick={() => setMobileNavOpen(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <Menu className="w-4 h-4 text-white/60" />
          </button>
          <div className="text-sm font-black text-white">{activeTab}</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="min-h-full"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
