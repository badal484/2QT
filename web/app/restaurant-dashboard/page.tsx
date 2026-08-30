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
  LogOut, RefreshCw, Utensils, ClipboardList, ChefHat, Store, Users, UtensilsCrossed, LayoutGrid, TrendingUp, Bell, Send, Sparkles, Lock,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../providers";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const RESTAURANT_DASHBOARD_ROLES = ["partner_kitchen", "super_admin", "admin"];

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

function SalesTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/restaurant/sales");
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load sales");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocketRefresh(["new_order", "order_updated"], load);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/[0.03] rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Today" value={fmt(data?.today?.sales)} accent />
        <StatTile label="This Week" value={fmt(data?.thisWeek?.sales)} />
        <StatTile label="This Month" value={fmt(data?.thisMonth?.sales)} />
        <StatTile label="All Time" value={fmt(data?.allTime?.sales)} />
      </div>
      {data?.trend && data.trend.length > 0 && (
        <SectionCard title="7-Day Sales" meta={`${data.allTime?.orders ?? 0} orders all time`}>
          {/* key forces a clean remount once real data is known, instead of ResponsiveContainer
              trying to reuse a measurement it may have taken before this card had settled into
              its final layout size (the same class of bug fixed for the Kitchen-step map). */}
          <div key={JSON.stringify(data.trend)} className="h-56 w-full min-w-[280px] p-4">
            <ResponsiveContainer width="100%" height="100%" minHeight={224} debounce={1}>
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10}
                  tickFormatter={(t) => new Date(t).toLocaleDateString("en-IN", { weekday: "short" })}
                  axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10}
                  tickFormatter={(t) => `₹${t / 100}`} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0d0d1a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                  itemStyle={{ color: "#F97316", fontWeight: "bold" }}
                  formatter={(value: any) => [fmt(value || 0), "Sales"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                />
                <Line type="monotone" dataKey="sales" stroke="#F97316" strokeWidth={3}
                  dot={{ r: 4, fill: "#0d0d1a", stroke: "#F97316", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#F97316", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}
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

function AddRiderForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!/^\d{10}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    setSubmitting(true);
    try {
      await api.post("/restaurant/staff/riders", { name: name.trim() || undefined, phone });
      toast.success("Rider added");
      setName(""); setPhone("");
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to add rider");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[140px]">
        <label className="text-[10px] font-black uppercase text-white/40">Name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rider name"
          className="w-full mt-1 bg-[#11111a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
      </div>
      <div className="flex-1 min-w-[140px]">
        <label className="text-[10px] font-black uppercase text-white/40">Mobile Number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number"
          className="w-full mt-1 bg-[#11111a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" />
      </div>
      <button onClick={submit} disabled={submitting}
        className="bg-[#F97316] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
        {submitting ? "Adding…" : "Add Rider"}
      </button>
    </div>
  );
}

function StaffTab({ deliveryModel }: { deliveryModel?: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setStaff((await api.get("/restaurant/staff")).staff || []); }
    catch (err: any) { toast.error(err.message || "Failed to load staff"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const removeStaff = async (id: string) => {
    if (!confirm("Remove this person from your team?")) return;
    try {
      await api.delete(`/restaurant/staff/${id}`);
      toast.success("Removed");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove");
    }
  };

  return (
    <div className="space-y-4">
      {deliveryModel === "dedicated_fleet" ? (
        <AddRiderForm onAdded={load} />
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-xs text-white/40 leading-relaxed">
          Your orders are currently delivered by 2QT's shared rider fleet. Ask 2QT to switch you to a dedicated fleet if you'd like to run your own delivery riders instead.
        </div>
      )}
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
                {s.membership_role === "rider" && (
                  <button onClick={() => removeStaff(s.id)} className="text-[10px] font-black uppercase text-red-400/70 hover:text-red-400 ml-1">Remove</button>
                )}
              </div>
            </div>
          ))}
      </SectionCard>
    </div>
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

// ─── Marketing Broadcast (Self-Serve Push Notifications) ──────────────────────

function BroadcastTab({ restaurant }: { restaurant: any }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/restaurant/broadcast/status");
      setStatus(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load broadcast status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const insertTag = (tag: string) => {
    setBody((prev) => (prev ? prev + " " + tag : tag));
  };

  const applyTemplate = (tTitle: string, tBody: string) => {
    setTitle(tTitle);
    setBody(tBody);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error("Title and message are required");

    const confirmMsg = `Send this push broadcast to ${status?.audienceCount ?? 0} past customers of ${restaurant?.name || "your restaurant"}?`;
    if (!confirm(confirmMsg)) return;

    setSending(true);
    try {
      const res = await api.post("/restaurant/broadcast", {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success(res.message || "Broadcast queued successfully!");
      setTitle("");
      setBody("");
      setImageUrl("");
      loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-white/30 text-sm">Loading broadcast status…</div>;

  if (!status?.allowBroadcast) {
    return (
      <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white">Self-Serve Broadcast Disabled</h3>
          <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
            Push notifications to your past customers are currently locked for this restaurant.
            Please reach out to the <strong className="text-white">2QT Platform Super-Admin</strong> to activate marketing broadcast access.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          Permission Required: <span className="text-amber-400">allow_broadcast</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile label="Eligible Customers" value={`${status.audienceCount} People`} accent />
        <StatTile label="Weekly Quota" value={`${status.weeklyUsed} / ${status.weeklyMax} Sent`} />
        <StatTile
          label="Quiet Hours Status"
          value={
            <span className={status.isWithinHours ? "text-emerald-400" : "text-amber-400"}>
              {status.isWithinHours ? "Active (10am–9:30pm)" : "Quiet Hours"}
            </span>
          }
        />
      </div>

      {/* Templates */}
      <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4 space-y-3">
        <div className="text-xs font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#F97316]" /> Quick Marketing Templates
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => applyTemplate("Weekend Special Feast! 🍲", "Hey {{first_name}}, treat yourself today! Enjoy chef special delights freshly prepared at our kitchen.")}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left transition-all"
          >
            <div className="text-xs font-bold text-white">Weekend Special</div>
            <div className="text-[10px] text-white/40 truncate mt-0.5">Hey &#123;&#123;first_name&#125;&#125;, treat yourself today...</div>
          </button>
          <button
            type="button"
            onClick={() => applyTemplate("New Menu Items Dropped! 🔥", "Craving something new? Explore delicious new dishes added to our menu today. Order hot & fresh!")}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left transition-all"
          >
            <div className="text-xs font-bold text-white">New Dish Launch</div>
            <div className="text-[10px] text-white/40 truncate mt-0.5">Explore delicious new dishes...</div>
          </button>
          <button
            type="button"
            onClick={() => applyTemplate("Special Chef Recommendation ✨", "{{first_name}}, hot comfort food is just a tap away. Freshly cooked and delivered fast!")}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left transition-all"
          >
            <div className="text-xs font-bold text-white">Chef's Choice</div>
            <div className="text-[10px] text-white/40 truncate mt-0.5">&#123;&#123;first_name&#125;&#125;, hot comfort food...</div>
          </button>
        </div>
      </div>

      {/* Composer & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={handleSend} className="lg:col-span-3 bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="text-sm font-bold text-white flex items-center justify-between">
            <span>Compose Push Broadcast</span>
            <span className="text-[10px] text-white/40 font-mono">Targets {status.audienceCount} customers</span>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Notification Title</label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Weekend Special: 20% Off Biryani! 🔥"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Message Content</label>
              <span className="text-[10px] text-white/30 font-mono">{body.length} / 300</span>
            </div>
            <textarea
              required
              rows={3}
              maxLength={300}
              placeholder="e.g. Hey {{first_name}}, treat yourself today with our chef specials! Tap to view menu."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#F97316] resize-none"
            />
            {/* Dynamic tag pills */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-white/40 font-bold uppercase mr-1">Insert:</span>
              <button
                type="button"
                onClick={() => insertTag("{{first_name}}")}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-[#F97316] transition-all"
              >
                + &#123;&#123;first_name&#125;&#125;
              </button>
              <button
                type="button"
                onClick={() => insertTag("{{name}}")}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-[#F97316] transition-all"
              >
                + &#123;&#123;name&#125;&#125;
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Banner Image URL (Optional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !status.canBroadcastNow || !title.trim() || !body.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Dispatching Broadcast…" : `Send Push to ${status.audienceCount} Customers`}
          </button>
        </form>

        {/* Live Mobile Push Preview Card */}
        <div className="lg:col-span-2 space-y-3">
          <div className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Live Customer Preview</div>
          <div className="bg-[#121224] border border-white/10 rounded-2xl p-4 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span className="font-bold flex items-center gap-1">
                <Utensils className="w-2.5 h-2.5 text-[#F97316]" /> 2QT Delivery · Now
              </span>
            </div>
            <div className="text-xs font-bold text-white">
              {title || "Notification Title Here"}
            </div>
            <div className="text-[11px] text-white/70 leading-snug">
              {(body || "Your message body will appear here for customers. Personalization tags like {{first_name}} will be replaced automatically.").replace(/\{\{\s*first_name\s*\}\}/gi, "Rahul").replace(/\{\{\s*name\s*\}\}/gi, "Rahul Sharma")}
            </div>
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-white/10 max-h-24 bg-black/40">
                <img src={imageUrl} alt="Preview" className="w-full h-24 object-cover" />
              </div>
            )}
            <div className="text-[9px] text-[#F97316] font-bold uppercase tracking-wider pt-1 flex items-center gap-1">
              <span>👉 Tapping opens your restaurant menu</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard shell ──────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "broadcast", label: "Broadcast", icon: Bell },
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
            {tab === "sales" && <SalesTab />}
            {tab === "orders" && <OrdersTab />}
            {tab === "broadcast" && <BroadcastTab restaurant={restaurant} />}
            {tab === "kitchens" && <KitchensTab />}
            {tab === "outlets" && <OutletsTab />}
            {tab === "staff" && <StaffTab deliveryModel={restaurant?.delivery_model} />}
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
    // Kitchen staff (manager, chef, packer) belong to the Kitchen portal (/kitchen)
    if (["chef", "kitchen_manager", "packer"].includes(user.role)) {
      router.replace("/kitchen");
      return;
    }
    if (!RESTAURANT_DASHBOARD_ROLES.includes(user.role)) {
      toast.error("Access denied. Partner restaurant credentials required.");
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
