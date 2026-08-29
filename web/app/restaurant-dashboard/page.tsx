"use client";

// Phase 5 (SaaS migration) — the restaurant tenant's own operational dashboard.
//
// Not the same as /restaurant (dine-in table-booking POS, role: dine_in_staff) or
// /kitchen-portal (the existing partner_kitchen earnings-only view). This is the new,
// broader SaaS tenant dashboard for chef/kitchen_manager/packer/partner_kitchen staff,
// consuming the /restaurant (singular) backend API introduced this phase.
//
// All tenant isolation is enforced server-side (see backend/src/routes/restaurant.ts and
// utils/tenant.ts's requireActiveRestaurantMembership) — this page never trusts anything about
// "which restaurant" beyond what each API response already scoped for it.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, RefreshCw, Utensils, ClipboardList, ChefHat, Store, Users, UtensilsCrossed, LayoutGrid,
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../providers";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const RESTAURANT_DASHBOARD_ROLES = ["partner_kitchen", "kitchen_manager", "chef", "packer"];

const fmt = (paise: number | string) =>
  `₹${(parseInt(String(paise || 0)) / 100).toLocaleString("en-IN")}`;

// ─── Small building blocks ────────────────────────────────────────────────────

function StatTile({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${accent ? "bg-[#F97316]/10 border-[#F97316]/30" : "bg-white/[0.02] border-white/[0.08]"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-[#F97316]" : "text-white/40"}`}>{label}</div>
      <div className={`text-2xl font-black mt-1 ${accent ? "text-[#F97316]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-white/30 text-sm">{text}</div>;
}

function SectionCard({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <span className="text-sm font-bold text-white">{title}</span>
        {meta && <span className="text-xs text-white/30">{meta}</span>}
      </div>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "text-white/40 bg-white/5",
  confirmed: "text-amber-400 bg-amber-500/10",
  preparing: "text-blue-400 bg-blue-500/10",
  packing: "text-orange-400 bg-orange-500/10",
  ready_for_pickup: "text-purple-400 bg-purple-500/10",
  out_for_delivery: "text-cyan-400 bg-cyan-500/10",
  delivered: "text-emerald-400 bg-emerald-500/10",
  cancelled: "text-red-400 bg-red-500/10",
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ restaurant, stats }: { restaurant: any; stats: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
        <div className="text-lg font-black text-white">{restaurant?.name || "—"}</div>
        <div className="text-xs text-white/30 mt-1 font-mono">{restaurant?.slug}</div>
        <div className="text-xs text-white/40 mt-2">
          Status: <span className="capitalize text-white/70 font-semibold">{restaurant?.status}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Orders Today (Delivered)" value={stats?.orders?.delivered_today ?? "—"} accent />
        <StatTile label="Pending" value={stats?.orders?.pending ?? "—"} />
        <StatTile label="Preparing" value={stats?.orders?.preparing ?? "—"} />
        <StatTile label="Out For Delivery" value={stats?.orders?.out_for_delivery ?? "—"} />
        <StatTile label="Active Kitchens" value={stats?.activeKitchens ?? "—"} />
        <StatTile label="Active Staff" value={stats?.activeStaff ?? "—"} />
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await api.get(`/restaurant/orders${qs}`);
      setOrders(res.orders || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load orders");
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);
  useSocketRefresh(["new_order", "order_updated", "order_cancelled"], load);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {["", "confirmed", "preparing", "packing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"].map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${status === s ? "bg-[#F97316] text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
            {s ? s.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>
      <SectionCard title="Orders" meta={loading ? "Loading…" : `${orders.length} shown`}>
        {orders.length === 0 && !loading
          ? <EmptyState text="No orders found" />
          : orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-xs font-mono text-white/70">#{o.display_id}</div>
                <div className="text-[11px] text-white/30 mt-0.5">{o.customer_name} · {new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${STATUS_COLOR[o.status] || "text-white/40 bg-white/5"}`}>{o.status.replace(/_/g, " ")}</span>
                <span className="text-sm font-black text-white">{fmt(o.total_amount_paise)}</span>
              </div>
            </div>
          ))}
      </SectionCard>
    </div>
  );
}

function KitchensTab() {
  const [kitchens, setKitchens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setKitchens((await api.get("/restaurant/kitchens")).kitchens || []); }
      catch (err: any) { toast.error(err.message || "Failed to load kitchens"); }
      finally { setLoading(false); }
    })();
  }, []);
  return (
    <SectionCard title="Kitchens" meta={loading ? "Loading…" : `${kitchens.length} total`}>
      {kitchens.length === 0 && !loading
        ? <EmptyState text="No kitchens yet" />
        : kitchens.map((k) => (
          <div key={k.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-bold text-white">{k.name}</div>
              <div className="text-[11px] text-white/30 mt-0.5">{k.address}</div>
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${k.is_paused ? "text-amber-400 bg-amber-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
              {k.is_paused ? "Paused" : "Live"}
            </span>
          </div>
        ))}
    </SectionCard>
  );
}

function OutletsTab() {
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setOutlets((await api.get("/restaurant/outlets")).outlets || []); }
      catch (err: any) { toast.error(err.message || "Failed to load outlets"); }
      finally { setLoading(false); }
    })();
  }, []);
  return (
    <SectionCard title="Outlets" meta={loading ? "Loading…" : `${outlets.length} total`}>
      {outlets.length === 0 && !loading
        ? <EmptyState text="No outlets yet" />
        : outlets.map((o) => (
          <div key={o.id} className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-bold text-white">{o.name}</div>
            <span className="text-[10px] font-black px-2 py-1 rounded-full uppercase text-white/50 bg-white/5">{o.status}</span>
          </div>
        ))}
    </SectionCard>
  );
}

function StaffTab() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setStaff((await api.get("/restaurant/staff")).staff || []); }
      catch (err: any) { toast.error(err.message || "Failed to load staff"); }
      finally { setLoading(false); }
    })();
  }, []);
  return (
    <SectionCard title="Staff" meta={loading ? "Loading…" : `${staff.length} members`}>
      {staff.length === 0 && !loading
        ? <EmptyState text="No staff yet" />
        : staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-bold text-white">{s.name}</div>
              <div className="text-[11px] text-white/30 mt-0.5 font-mono">{s.phone}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-1 rounded-full uppercase text-[#F97316] bg-[#F97316]/10">{s.membership_role}</span>
              <span className={`w-2 h-2 rounded-full ${s.is_online ? "bg-emerald-400" : "bg-white/20"}`} title={s.is_online ? "Online" : "Offline"} />
            </div>
          </div>
        ))}
    </SectionCard>
  );
}

function MenuTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setItems((await api.get("/restaurant/menu")).menu || []); }
      catch (err: any) { toast.error(err.message || "Failed to load menu"); }
      finally { setLoading(false); }
    })();
  }, []);
  return (
    <div className="space-y-3">
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-xs text-white/40 leading-relaxed">
        Menu is currently read-only from this dashboard. Item creation and pricing remain managed by 2QT admin — restaurant-owned menu management is planned for a later phase.
      </div>
      <SectionCard title="Menu" meta={loading ? "Loading…" : `${items.length} items`}>
        {items.length === 0 && !loading
          ? <EmptyState text="No menu items yet" />
          : items.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-bold text-white">{m.name}</div>
                <div className="text-[11px] text-white/30 mt-0.5 capitalize">{m.category}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${m.available ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                  {m.available ? "Available" : "Sold out"}
                </span>
                <span className="text-sm font-black text-white">{fmt(m.price_paise)}</span>
              </div>
            </div>
          ))}
      </SectionCard>
    </div>
  );
}

// ─── Dashboard shell ──────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "kitchens", label: "Kitchens", icon: ChefHat },
  { id: "outlets", label: "Outlets", icon: Store },
  { id: "staff", label: "Staff", icon: Users },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
] as const;

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [restaurant, setRestaurant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, statsRes] = await Promise.all([
        api.get("/restaurant/me"),
        api.get("/restaurant/stats"),
      ]);
      setRestaurant(meRes.restaurant);
      setStats(statsRes);
    } catch (err: any) {
      toast.error(err.message || "Failed to load restaurant");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useSocketRefresh(["new_order", "order_updated"], loadOverview);

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans">
      <header className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between bg-[#0a0a14] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center">
            <Utensils className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-black text-white leading-none">{restaurant?.name || "Restaurant Dashboard"}</div>
            <div className="text-[10px] text-white/30 mt-0.5">2QT Restaurant Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadOverview} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex gap-2 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === id ? "bg-[#F97316] text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {tab === "overview" && <OverviewTab restaurant={restaurant} stats={stats} />}
            {tab === "orders" && <OrdersTab />}
            {tab === "kitchens" && <KitchensTab />}
            {tab === "outlets" && <OutletsTab />}
            {tab === "staff" && <StaffTab />}
            {tab === "menu" && <MenuTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RestaurantDashboardPage() {
  const { user, loading, logout } = useAuth()!;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login?redirect=/restaurant-dashboard");
      return;
    }
    if (!RESTAURANT_DASHBOARD_ROLES.includes(user.role)) {
      toast.error("Access denied. Restaurant staff credentials required.");
      router.push("/menu");
    }
  }, [user, loading, router]);

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    router.push("/login");
  };

  if (loading || !user || !RESTAURANT_DASHBOARD_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen bg-[#07070e] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  return <Dashboard onLogout={handleLogout} />;
}
