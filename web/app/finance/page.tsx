"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Wallet, Bike, Utensils, Receipt,
  BarChart3, LogOut, IndianRupee, Menu, X, Store, RotateCcw
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const OverviewTab = dynamic(() => import("./OverviewTab").then(m => ({ default: m.OverviewTab })), { ssr: false });
const CODTab = dynamic(() => import("./CODTab").then(m => ({ default: m.CODTab })), { ssr: false });
const RiderPayoutsTab = dynamic(() => import("./RiderPayoutsTab").then(m => ({ default: m.RiderPayoutsTab })), { ssr: false });
const KitchenPayoutsTab = dynamic(() => import("./KitchenPayoutsTab").then(m => ({ default: m.KitchenPayoutsTab })), { ssr: false });
const TransactionsTab = dynamic(() => import("./TransactionsTab").then(m => ({ default: m.TransactionsTab })), { ssr: false });
const ProductsTab = dynamic(() => import("./ProductsTab").then(m => ({ default: m.ProductsTab })), { ssr: false });
const PartnersTab = dynamic(() => import("./PartnersTab").then(m => ({ default: m.PartnersTab })), { ssr: false });
const RefundsTab = dynamic(() => import("./RefundsTab").then(m => ({ default: m.RefundsTab })), { ssr: false });

const TABS = [
  { name: "Overview",        icon: LayoutDashboard, component: OverviewTab,       section: "Main" },
  { name: "COD Cash",        icon: Wallet,           component: CODTab,            section: "Main" },
  { name: "Refunds",         icon: RotateCcw,        component: RefundsTab,        section: "Main" },
  { name: "Rider Payouts",   icon: Bike,             component: RiderPayoutsTab,   section: "Payouts" },
  { name: "Kitchen Payouts", icon: Utensils,         component: KitchenPayoutsTab, section: "Payouts" },
  { name: "Partners",        icon: Store,            component: PartnersTab,       section: "Payouts" },
  { name: "Transactions",    icon: Receipt,          component: TransactionsTab,   section: "Reports" },
  { name: "Products",        icon: BarChart3,        component: ProductsTab,       section: "Reports" },
];

const SECTIONS = ["Main", "Payouts", "Reports"];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function FinancePage() {
  const { user, loading, logout } = useAuth()!;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isFinanceUser = user && ["finance", "super_admin"].includes(user.role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login?redirect=/finance");
      return;
    }
    if (!isFinanceUser) {
      toast.error("Access denied. Finance team credentials required.");
      router.push("/menu");
    }
  }, [user, loading, isFinanceUser, router]);

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    router.push("/login");
  };

  if (loading || !user || !isFinanceUser) {
    return (
      <div className="min-h-screen bg-[#07070e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
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
