"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Users, ShoppingBag, TrendingUp, LayoutDashboard,
  Utensils, Settings, Search, ArrowUpRight, LogOut,
  CheckCircle2, XCircle, RefreshCw, AlertCircle, Bike, Star, Rocket,
  ToggleLeft, ToggleRight, Send, Clock, Plus, X, Trash2, Edit3,
  Package, Info, ChevronRight, Filter, ChevronDown, Calendar, Box,
  LifeBuoy, Wallet, Download, Activity, Cpu, Camera, ArrowUp, ArrowDown, Zap, Bell, MoreHorizontal, Command, MapPin, Store, Ticket, AlertTriangle, Receipt, LayoutGrid, Tag, FileWarning, CheckSquare, ShieldCheck, ShieldAlert, Trophy, Layers
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { SkeletonList, SkeletonStatCard, SkeletonOrderCard } from "../components/ui/Skeleton";
import { socket } from "../lib/socket";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";
import dynamic from "next/dynamic";

const MarketingTab = dynamic(() => import("./MarketingTab").then(m => ({ default: m.MarketingTab })), { ssr: false });
const MenuTab = dynamic(() => import("./MenuTab").then(m => ({ default: m.MenuTab })), { ssr: false });
const ZonesTab = dynamic(() => import("./ZonesTab").then(m => ({ default: m.ZonesTab })), { ssr: false });
const CategoriesTab = dynamic(() => import("./CategoriesTab").then(m => ({ default: m.CategoriesTab })), { ssr: false });
const DeliveryPricingTab = dynamic(() => import("./DeliveryPricingTab").then(m => ({ default: m.DeliveryPricingTab })), { ssr: false });
const KitchensTab = dynamic(() => import("./KitchensTab").then(m => ({ default: m.KitchensTab })), { ssr: false });
const PromoCodesTab = dynamic(() => import("./PromoCodesTab").then(m => ({ default: m.PromoCodesTab })), { ssr: false });
const KitchenHealthTab = dynamic(() => import("./KitchenHealthTab").then(m => ({ default: m.KitchenHealthTab })), { ssr: false });
const TeamTab = dynamic(() => import("./TeamTab").then(m => ({ default: m.TeamTab })), { ssr: false });
const CampaignsTab = dynamic(() => import("./CampaignsTab").then(m => ({ default: m.CampaignsTab })), { ssr: false });
const ComplaintsTab = dynamic(() => import("./ComplaintsTab").then(m => ({ default: m.ComplaintsTab })), { ssr: false });
const PartnersTab = dynamic(() => import("./PartnersTab").then(m => ({ default: m.PartnersTab })), { ssr: false });
const NotificationsTab = dynamic(() => import("./NotificationsTab").then(m => ({ default: m.NotificationsTab })), { ssr: false });
const DispatchTab = dynamic(() => import("./DispatchTab").then(m => ({ default: m.DispatchTab })), { ssr: false });
const MenuOffersTab = dynamic(() => import("./MenuOffersTab").then(m => ({ default: m.MenuOffersTab })), { ssr: false });
const RestaurantsTab = dynamic(() => import("./RestaurantsTab").then(m => ({ default: m.RestaurantsTab })), { ssr: false });
const ActivityTab = dynamic(() => import("./ActivityTab"), { ssr: false });
const RiderIssuesTab = dynamic(() => import("./RiderIssuesTab").then(m => ({ default: m.RiderIssuesTab })), { ssr: false });
const DeliveredOrdersTab = dynamic(() => import("./DeliveredOrdersTab").then(m => ({ default: m.DeliveredOrdersTab })), { ssr: false });
const RiderDocumentsTab = dynamic(() => import("./RiderDocumentsTab").then(m => ({ default: m.RiderDocumentsTab })), { ssr: false });
const RiderDetailDrawer = dynamic(() => import("./RiderDetailDrawer").then(m => ({ default: m.RiderDetailDrawer })), { ssr: false });
const SOSAlertsTab = dynamic(() => import("./SOSAlertsTab").then(m => ({ default: m.SOSAlertsTab })), { ssr: false });
const RatingsTab = dynamic(() => import("./RatingsTab").then(m => ({ default: m.RatingsTab })), { ssr: false });
const MissionsTab = dynamic(() => import("./MissionsTab").then(m => ({ default: m.MissionsTab })), { ssr: false });
const ZoneCapacityTab = dynamic(() => import("./ZoneCapacityTab").then(m => ({ default: m.ZoneCapacityTab })), { ssr: false });
const PreLaunchTab = dynamic(() => import("./PreLaunchTab").then(m => ({ default: m.PreLaunchTab })), { ssr: false });

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data, colors }: { data: number[]; colors: string[] }) {
  const max = Math.max(...data) || 1;
  return (
    <div className="flex items-end justify-between h-32 mt-6 gap-2 w-full">
      {data.map((val, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${(val / max) * 100}%` }}
          transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="w-full rounded-t-sm opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
          style={{ backgroundColor: colors[i % colors.length] }}
        />
      ))}
    </div>
  );
}


// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
      <polyline
        points={`0,${h} ${points} ${w},${h}`}
        stroke="none"
        fill={color}
        opacity="0.12"
      />
    </svg>
  );
}

import { AdminScopeProvider, useAdminScope } from "./AdminScopeContext";
import { AdminScopeHeader } from "./AdminScopeHeader";

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewTab() {
  const { getScopeQueryParams, selectedZoneId, selectedKitchenId } = useAdminScope();
  const [stats, setStats] = useState<any>(null);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const scopeParams = getScopeQueryParams();
      const [s, o] = await Promise.all([
        api.get(`/admin/dashboard${scopeParams}`),
        api.get(`/admin/orders/live${scopeParams}`),
      ]);
      setStats(s);
      setLiveOrders(o.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, [getScopeQueryParams]);

  useEffect(() => { 
    load(); 
    socket.on("new_order", load);
    socket.on("order_status_update", load);
    socket.on("order_cancelled", load);
    return () => {
      socket.off("new_order", load);
      socket.off("order_status_update", load);
      socket.off("order_cancelled", load);
    };
  }, [load, selectedZoneId, selectedKitchenId]);

  const rev = (stats?.todayRevenuePaise ?? 0) / 100;
  const weeklyRaw: number[] = stats?.weeklyRevenue?.map((d: any) => d.revenuePaise) ?? [];
  const weeklyLabels: string[] = stats?.weeklyRevenue?.map((d: any) => d.label) ?? [];
  const maxRev = Math.max(...weeklyRaw, 1);
  const revData = weeklyRaw.length > 0
    ? weeklyRaw.map(v => Math.round((v / maxRev) * 100))
    : Array(7).fill(0);
  const barColors = Array(7).fill("#3b82f6").map((c, i) => i === 6 ? "#10b981" : c);
  const weeklyTotal = weeklyRaw.reduce((s, v) => s + v, 0) / 100;

  const statCards = stats ? [
    {
      label: "Active Orders", value: stats.activeOrders,
      trend: "live", up: true, icon: ShoppingBag,
      iconColor: "text-brand-primary", iconBg: "bg-brand-primary/10",
      trendColor: "text-emerald-400", sparkColor: "#10b981",
      sparkData: Array(10).fill(stats.activeOrders),
    },
    {
      label: "Customers", value: (stats.totalCustomers ?? 0).toLocaleString("en-IN"),
      trend: "total", up: true, icon: Users,
      iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10",
      trendColor: "text-zinc-500", sparkColor: "#10b981",
      sparkData: Array(10).fill(stats.totalCustomers ?? 0),
    },
    {
      label: "Riders Online", value: stats.ridersOnline,
      trend: "live", up: true, icon: Bike,
      iconColor: "text-blue-400", iconBg: "bg-blue-500/10",
      trendColor: "text-emerald-400", sparkColor: "#3b82f6",
      sparkData: Array(10).fill(stats.ridersOnline),
    },
    {
      label: "Stock Alerts", value: stats.lowStockAlerts,
      trend: stats.lowStockAlerts > 0 ? "action needed" : "all clear", up: false, icon: AlertCircle,
      iconColor: "text-red-400", iconBg: "bg-red-500/10",
      trendColor: stats.lowStockAlerts > 0 ? "text-red-400" : "text-emerald-400", sparkColor: "#ef4444",
      sparkData: Array(10).fill(stats.lowStockAlerts),
    },
  ] : [];

  const columns = useMemo(() => [
    { id: "confirmed", title: "Confirmed", count: liveOrders.filter(o => o.status === "confirmed").length, color: "emerald", border: "border-t-emerald-500", dot: "bg-emerald-500", orders: liveOrders.filter(o => o.status === "confirmed") },
    { id: "preparing", title: "Preparing", count: liveOrders.filter(o => o.status === "preparing").length, color: "blue", border: "border-t-blue-500", dot: "bg-blue-500", orders: liveOrders.filter(o => o.status === "preparing") },
    { id: "ready_for_pickup", title: "Ready", count: liveOrders.filter(o => o.status === "ready_for_pickup").length, color: "purple", border: "border-t-purple-500", dot: "bg-purple-500", orders: liveOrders.filter(o => o.status === "ready_for_pickup") },
    { id: "out_for_delivery", title: "Delivering", count: liveOrders.filter(o => o.status === "out_for_delivery").length, color: "orange", border: "border-t-brand-primary", dot: "bg-brand-primary", orders: liveOrders.filter(o => o.status === "out_for_delivery") },
  ], [liveOrders]);

  return (
    <div className="space-y-6">
      {/* ── Top Dashboard Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hero Revenue Card */}
        <div className="lg:col-span-6 bg-[#11111a] rounded-[24px] border border-white/[0.05] p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-semibold text-zinc-400 mb-2">Revenue (Last 7 Days)</p>
              <h2 className="text-5xl font-black text-white">₹{weeklyTotal.toLocaleString("en-IN")}</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-blue-400">7-day</span>
            </div>
          </div>
          <div className="relative z-10 w-full mt-4">
            <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-between pointer-events-none">
              {[120, 80, 40, 0].map(y => (
                <div key={y} className="flex items-center w-full">
                  <span className="text-[10px] text-zinc-600 font-mono w-6">{y}</span>
                  <div className="flex-1 h-px bg-white/[0.03]" />
                </div>
              ))}
            </div>
            <div className="pl-8">
              <BarChart data={revData} colors={barColors} />
              <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2">
                {(weeklyLabels.length > 0 ? weeklyLabels : ['','','','','','','Today']).map((l, i) => (
                  <span key={i}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2x2 Stat Grid */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-6">
          {loading ? <SkeletonStatCard /> : statCards.map((s, i) => (
            <div key={i} className="bg-[#11111a] rounded-[20px] border border-white/[0.05] p-5 flex flex-col justify-between shadow-xl group">
              <div className="flex justify-between items-start mb-2">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
              </div>
              <p className="text-sm font-semibold text-zinc-400 mb-1">{s.label}</p>
              <h3 className="text-3xl font-black text-white mb-2">{s.value}</h3>
              <div className="flex items-end justify-between">
                <span className={`text-[11px] font-bold ${s.trendColor}`}>{s.trend}</span>
                <div className="w-16">
                  <Sparkline data={s.sparkData} color={s.sparkColor} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Order Pipeline (Kanban) ── */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Order Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {columns.map(col => (
            <div key={col.id} className="flex flex-col bg-[#0b0b13] rounded-2xl border border-white/[0.05] overflow-hidden min-h-[400px]">
              {/* Column Header */}
              <div className={`px-4 py-3 bg-[#11111a] border-b border-white/[0.05] flex items-center justify-between border-t-2 ${col.border}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{col.title}</span>
                </div>
                <span className="w-6 h-6 rounded-md bg-white/[0.05] flex items-center justify-center text-xs font-bold text-zinc-400">
                  {col.count}
                </span>
              </div>
              {/* Cards Container */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                {col.orders.map(order => (
                  <motion.div
                    layout
                    key={order.id}
                    className="bg-[#11111a] border border-white/[0.05] rounded-xl p-4 cursor-pointer hover:border-white/[0.1] hover:bg-[#161622] transition-colors group relative"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-mono text-zinc-500">
                        Order ID {order.display_id?.replace('ORD-','').slice(-4) || order.id.slice(-4)}
                      </span>
                      <button className="text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-white mb-4">{order.customer_name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-[10px] font-bold text-zinc-300`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                        {col.title}
                      </span>
                    </div>
                  </motion.div>
                ))}
                {col.orders.length === 0 && (
                  <div className="h-full flex items-center justify-center text-xs font-bold text-zinc-600 uppercase tracking-widest pt-10">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-[#11111a] rounded-[24px] border border-white/[0.05] p-6 mt-6">
        <h3 className="text-lg font-bold text-white mb-6">Recent activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            { icon: Wallet, color: "text-emerald-400", bg: "bg-emerald-500/10", text: `Today's revenue: ₹${((stats?.todayRevenuePaise ?? 0) / 100).toLocaleString("en-IN")}`, time: "Updated just now" },
            { icon: ShoppingBag, color: "text-brand-primary", bg: "bg-brand-primary/10", text: `${stats?.activeOrders ?? 0} active orders in the pipeline`, time: "Live" },
            { icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/10", text: `${stats?.ridersOnline ?? 0} riders online and ready`, time: "Live" },
          ].map((act, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${act.bg}`}>
                  <act.icon className={`w-4 h-4 ${act.color}`} />
                </div>
                {i < 2 && <div className="w-px h-8 bg-white/[0.05] my-1" />}
              </div>
              <div className="pt-2">
                <p className="text-sm font-medium text-zinc-200">{act.text}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{act.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  const load = async () => {
    try {
      const d = await api.get("/admin/orders/live");
      setOrders(d.orders ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
    socket.on("new_order", load);
    socket.on("order_status_update", load);
    socket.on("order_cancelled", load);
    return () => {
      socket.off("new_order", load);
      socket.off("order_status_update", load);
      socket.off("order_cancelled", load);
    };
  }, []);

  const handleCancelClick = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  const processCancel = async () => {
    const { id } = confirmDialog;
    setConfirmDialog({ isOpen: false, id: null });
    if (!id) return;
    
    setCancelling(id);
    try {
      await api.patch(`/admin/orders/${id}/status`, { status: 'cancelled' });
      toast.success("Order cancelled");
      load();
    } finally {
      setCancelling(null);
    }
  };

  const forceStatus = async (id: string, currentStatus: string) => {
    const statusSteps = ["confirmed", "preparing", "packing", "ready_for_pickup", "out_for_delivery", "delivered"];
    const idx = statusSteps.indexOf(currentStatus);
    if (idx === -1 || idx === statusSteps.length - 1) return;
    const nextStatus = statusSteps[idx + 1];
    try {
      await api.patch(`/admin/orders/${id}/status`, { status: nextStatus });
      toast.success(`Force advanced to ${nextStatus.replace(/_/g, " ")}`);
      load();
    } catch (e) {
      toast.error("Failed to update status");
    }
  };


  const handleCompleteAllLive = async () => {
    if (!confirm("Are you sure you want to mark ALL live active orders as DELIVERED?")) return;
    try {
      const res: any = await api.post("/admin/orders/complete-all-live");
      toast.success(`Completed ${res.count || 0} live orders!`);
      load();
    } catch (e: any) {
      toast.error(e?.message || e?.response?.data?.message || e?.response?.data?.error || "Failed to complete live orders");
    }
  };

  const statusSteps = ["confirmed", "preparing", "packing", "ready_for_pickup", "out_for_delivery", "delivered"];
  const statusColor: Record<string, string> = {
    confirmed: "text-amber-500 bg-amber-500/10",
    preparing: "text-swish-green bg-swish-green/10",
    packing: "text-orange-400 bg-orange-500/10",
    ready_for_pickup: "text-blue-400 bg-blue-500/10",
    out_for_delivery: "text-purple-400 bg-purple-500/10",
    delivered: "text-zinc-400 bg-white/[0.04] backdrop-blur-xl",
    cancelled: "text-red-400 bg-red-100",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white">Orders</h2>
        <div className="flex items-center gap-4">
          {orders.length > 0 && (
            <button
              onClick={handleCompleteAllLive}
              className="px-4 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs hover:bg-emerald-500/30 transition-all flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete All Live Orders ({orders.length})
            </button>
          )}
          <button onClick={load} className="w-10 h-10 rounded-xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-zinc-400">{orders.length} live orders</span>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={3} item={<SkeletonOrderCard />} />
      ) : orders.length === 0 ? (
        <div className="text-center py-24 text-zinc-300 font-black uppercase tracking-widest text-sm">No live orders right now</div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 shadow-2xl shadow-black/40 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="px-4 h-12 shrink-0 whitespace-nowrap rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 flex items-center justify-center font-black text-base text-white">
                    #{order.display_id}
                  </div>
                  <div>
                    <div className="font-black text-base text-white">{order.customer_name}</div>
                    <div className="text-[10px] text-zinc-400 font-bold">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      ₹{(order.total_amount_paise / 100).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-white/[0.04] p-1 rounded-2xl border border-white/10">
                    <button
                      onClick={async () => {
                        try {
                          toast.loading("Fetching invoice...", { id: `inv-${order.id}` });
                          const data = await api.get(`/orders/${order.id}/invoice`);
                          toast.dismiss(`inv-${order.id}`);
                          if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank");
                        } catch {
                          toast.error("Invoice fetch failed", { id: `inv-${order.id}` });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black font-black text-xs transition-all flex items-center gap-1.5"
                      title="View Customer Invoice PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          toast.loading("Regenerating invoice PDF...", { id: `reg-${order.id}` });
                          const data = await api.post(`/admin/orders/${order.id}/regenerate-invoice`);
                          toast.success("Invoice PDF updated!", { id: `reg-${order.id}` });
                          if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank");
                        } catch {
                          toast.error("Regeneration failed", { id: `reg-${order.id}` });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 font-bold text-xs transition-all flex items-center gap-1"
                      title="Re-apply Admin Settings & Regenerate PDF"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regen</span>
                    </button>
                  </div>
                  <button 
                    disabled={cancelling === order.id}
                    onClick={() => forceStatus(order.id, order.status)}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    Force Next
                  </button>
                  <button 
                    disabled={cancelling === order.id}
                    onClick={() => handleCancelClick(order.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${statusColor[order.status] ?? ""}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Status pipeline */}
              <div className="flex items-center gap-0 mt-4">
                {statusSteps.map((step, i) => {
                  const idx = statusSteps.indexOf(order.status);
                  const done = i <= idx;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`h-1.5 w-full rounded-full ${done ? "bg-swish-green" : "bg-white/[0.04] backdrop-blur-xl"} transition-colors`} />
                      {i === statusSteps.length - 1 && (
                        <div className={`w-3 h-3 rounded-full ml-1 ${done ? "bg-swish-green" : "bg-zinc-700/80"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                {statusSteps.map(step => (
                  <span key={step} className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                    {step.split("_")[0]}
                  </span>
                ))}
              </div>

              {/* Items & Notes */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-start justify-between">
                <div className="flex flex-wrap gap-2 flex-1">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 rounded-xl bg-white/[0.02] backdrop-blur-lg border border-white/10 text-[10px] font-bold flex items-center gap-2 text-white">
                      <span className="text-zinc-400">{item.quantity}×</span>
                      {item.menu_item_name}
                    </div>
                  ))}
                </div>
                {(order.special_instructions || order.is_scheduled) && (
                  <div className="flex flex-col items-end gap-2 ml-4">
                    {order.is_scheduled && (
                      <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[9px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Sched: {new Date(order.scheduled_for).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                    {order.special_instructions && (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[9px] font-bold text-amber-600 max-w-[200px] text-right italic">
                        "{order.special_instructions}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Cancel Order?"
        message="Are you sure you want to cancel this order? The customer will be refunded if payment was collected."
        confirmText="Cancel Order"
        onConfirm={processCancel}
        onCancel={() => setConfirmDialog({ isOpen: false, id: null })}
        isDanger={true}
      />
    </div>
  );
}

// ─── Scheduled Tab ────────────────────────────────────────────────────────────

function ScheduledTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => api.get("/admin/orders/scheduled").then(d => {
    setOrders(d.scheduledOrders ?? []);
    setLoading(false);
  });

  useEffect(() => { load(); }, []);
  useSocketRefresh(['new_order'], load);

  const cancelScheduled = async (id: string) => {
    if (!confirm('Cancel this scheduled order? The customer will be notified.')) return;
    setCancelling(true);
    try {
      await api.delete(`/admin/scheduled-orders/${id}`);
      setOrders(prev => prev.filter(o => o.id !== id));
      setSelectedId(null);
      toast.success('Scheduled order cancelled');
    } catch { toast.error('Failed to cancel'); }
    finally { setCancelling(false); }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Scheduled</h2>
        <p className="text-zinc-400 text-sm font-medium">Pre-orders and recurring meal plans.</p>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : orders.length === 0 ? (
        <div className="py-20 text-center bg-white/[0.02] backdrop-blur-lg rounded-[40px] border border-white/10 border-dashed">
          <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">No scheduled orders found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map(o => (
            <div key={o.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] backdrop-blur-xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400 leading-none mb-1">
                      {new Date(o.scheduled_for).toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                    <span className="text-lg font-black tracking-tighter leading-none text-white">
                      {new Date(o.scheduled_for).getDate()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-black tracking-tighter italic text-white">{o.customer_name}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-white/[0.04] backdrop-blur-xl text-zinc-400 text-[8px] font-black uppercase tracking-widest">
                        {new Date(o.scheduled_for).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      ₹{o.total_amount_paise / 100} • {o.type === "recurring" ? "Meal Plan" : "One-time Pre-order"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(prev => prev === o.id ? null : o.id)}
                  className="px-5 py-2.5 rounded-xl bg-swish-green/15 text-swish-green text-[10px] font-black uppercase tracking-widest hover:bg-swish-green/30 transition-all shadow-lg"
                >
                  {selectedId === o.id ? 'Close' : 'Manage'}
                </button>
              </div>
              {selectedId === o.id && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                    <span>Type: <span className="text-white font-bold">{o.type === 'recurring' ? 'Meal Plan' : 'One-time'}</span></span>
                    <span>Amount: <span className="text-white font-bold">₹{(o.total_amount_paise / 100).toLocaleString('en-IN')}</span></span>
                    <span>Slot: <span className="text-white font-bold">{new Date(o.scheduled_for).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                    {o.kitchen_name && <span>Kitchen: <span className="text-white font-bold">{o.kitchen_name}</span></span>}
                  </div>
                  <button
                    onClick={() => cancelScheduled(o.id)}
                    disabled={cancelling}
                    className="shrink-0 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel Order'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [creditPhone, setCreditPhone] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [crediting, setCrediting] = useState(false);

  const load = async () => {
    try {
      const queryParam = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : '';
      const d = await api.get(`/admin/users${queryParam}`);
      setUsers(d.users ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [searchQuery]);
  useSocketRefresh(['user_updated'], load);

  const toggleStatus = async (id: string, current: boolean) => {
    await api.patch(`/admin/users/${id}/status`, { is_active: !current });
    load();
    toast.success("User status updated");
  };

  const creditWallet = async () => {
    if (!creditPhone || !creditAmount) return;
    setCrediting(true);
    try {
      const d = await api.post('/admin/wallet/credit', {
        phone: creditPhone.trim(),
        amountRupees: parseFloat(creditAmount),
        note: creditNote.trim() || undefined,
      });
      toast.success(`✓ Credited ₹${creditAmount} — new balance ₹${((d.newBalancePaise ?? 0) / 100).toFixed(2)}`);
      setCreditPhone(''); setCreditAmount(''); setCreditNote('');
    } catch (e: any) {
      toast.error(e.message || 'Credit failed');
    } finally {
      setCrediting(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Customers</h2>
          <p className="text-zinc-400 text-sm font-medium">Platform user database.</p>
        </div>

        {/* Customer Search Bar */}
        <div className="relative min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
            placeholder="Search phone number (+91...) or name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Wallet Credit Panel */}
      <div className="mb-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-bold mb-1">Credit Wallet Balance</h3>
        <p className="text-zinc-500 text-xs mb-4">Add funds to a customer&apos;s in-app wallet (for refunds, compensation, or testing).</p>
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[140px] bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            placeholder="Customer phone"
            value={creditPhone}
            onChange={e => setCreditPhone(e.target.value)}
          />
          <input
            type="number"
            min={1}
            className="w-32 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            placeholder="₹ amount"
            value={creditAmount}
            onChange={e => setCreditAmount(e.target.value)}
          />
          <input
            className="flex-1 min-w-[140px] bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            placeholder="Note (optional)"
            value={creditNote}
            onChange={e => setCreditNote(e.target.value)}
          />
          <button
            onClick={creditWallet}
            disabled={crediting || !creditPhone || !creditAmount}
            className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold transition-all"
          >
            {crediting ? 'Crediting…' : 'Credit'}
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : users.length === 0 ? (
        <div className="py-20 text-center bg-white/[0.02] backdrop-blur-lg rounded-[40px] border border-white/10 border-dashed">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">No users found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map(u => (
            <div key={u.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-2xl shadow-black/40">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] backdrop-blur-xl flex items-center justify-center font-black italic text-zinc-400">
                  {u.name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                  <h3 className="font-bold text-white">{u.name}</h3>
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{u.phone} • {u.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                   <div className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-0.5">Joined</div>
                   <div className="text-[10px] font-bold text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => toggleStatus(u.id, u.is_active)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    u.is_active ? "bg-white/[0.04] backdrop-blur-xl text-zinc-400 hover:bg-red-50 hover:text-red-500" : "bg-red-500 text-white shadow-lg"
                  }`}
                >
                  {u.is_active ? "Block User" : "Unblock User"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fleet Tab ───────────────────────────────────────────────────────────────

function PayModelBadge({ paymentModel }: { paymentModel?: string }) {
  const isSalary = paymentModel === 'salary';
  return (
    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isSalary ? 'bg-blue-500/10 text-blue-400' : 'bg-swish-green/10 text-swish-green'}`}>
      {isSalary ? 'Salary' : 'Gig'}
    </span>
  );
}

function FleetTab({ onOpenRider }: { onOpenRider?: (id: string) => void }) {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModelFilter, setPayModelFilter] = useState<'all' | 'salary' | 'per_order'>('all');

  const load = async () => {
    try {
      const d = await api.get("/admin/riders");
      setRiders(d.riders ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const verifyRider = async (id: string) => {
    try {
      await api.post(`/admin/riders/${id}/verify`);
      toast.success("Rider verified successfully");
      load();
    } catch (e) {
      toast.error("Failed to verify rider");
    }
  };

  const pendingRiders = riders.filter(r => !r.is_verified);
  const payModelFiltered = riders.filter(r => payModelFilter === 'all' || r.payment_model === payModelFilter);
  const verifiedRiders = payModelFiltered.filter(r => r.is_verified);
  const onlineRiders = verifiedRiders.filter(r => r.is_online);
  const offlineRiders = verifiedRiders.filter(r => !r.is_online);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Fleet Command</h2>
          <p className="text-zinc-400 text-sm font-medium">Real-time rider tracking and performance metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/[0.03] backdrop-blur-2xl p-1 rounded-xl border border-white/10">
            {(['all', 'per_order', 'salary'] as const).map(f => (
              <button
                key={f}
                onClick={() => setPayModelFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${payModelFilter === f ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {f === 'all' ? 'All' : f === 'per_order' ? 'Gig' : 'Salary'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 bg-white/[0.03] backdrop-blur-2xl px-5 py-3 rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Online Fleet</span>
              <span className="text-xl font-black text-white">{onlineRiders.length} <span className="text-zinc-400">/ {verifiedRiders.length}</span></span>
            </div>
            <div className="w-12 h-12 rounded-full bg-swish-green/20 flex items-center justify-center text-swish-green">
              <Bike className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {pendingRiders.length > 0 && (
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Pending Verification
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRiders.map(r => (
              <div key={r.id} className="bg-amber-500/10 border border-amber-500/20 rounded-[24px] p-6 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center font-black italic text-amber-500">
                      {r.name?.[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{r.name}</h3>
                      <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{r.phone}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => verifyRider(r.id)}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Verify & Approve
                  </button>
                  {onOpenRider && (
                    <button
                      onClick={() => onOpenRider(r.id)}
                      className="px-3 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Profile
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
            <div className="w-2 h-2 rounded-full bg-swish-green animate-pulse" /> Active Riders
          </h3>
          {loading ? (
            <SkeletonList rows={2} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onlineRiders.map(r => {
                const onDelivery = r.active_orders && r.active_orders.length > 0;
                return (
                <div key={r.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 shadow-2xl shadow-black/40 hover:shadow-2xl hover:shadow-black/60 transition-all relative overflow-hidden">
                  {onDelivery && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-swish-green" />
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/[0.04] backdrop-blur-xl flex items-center justify-center font-black italic text-zinc-400">
                        {r.name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-1.5">{r.name} <PayModelBadge paymentModel={r.payment_model} /></h3>
                        <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{r.phone}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${onDelivery ? 'bg-swish-green/10 text-swish-green' : 'bg-blue-500/10 text-blue-500'}`}>
                      {onDelivery ? "On Delivery" : "Idle"}
                    </span>
                  </div>

                  {onDelivery ? (
                    <div className="bg-white/[0.02] backdrop-blur-lg rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Current Order</span>
                       <span className="font-black text-sm text-white">
                         {onDelivery ? `(${r.active_orders.length})` : ''}
                         {r.active_orders?.[0]?.display_id || ''}
                       </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] backdrop-blur-lg/50 rounded-xl p-4 border border-white/10 border-dashed text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Waiting for dispatch</span>
                    </div>
                  )}
                  {onOpenRider && (
                    <button onClick={() => onOpenRider(r.id)} className="mt-3 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                      View Full Profile
                    </button>
                  )}
                </div>
              );
              })}
              {onlineRiders.length === 0 && !loading && (
                <div className="col-span-full py-12 text-center border border-white/10 border-dashed rounded-[24px]">
                  <p className="text-zinc-500 text-sm font-bold">No active riders</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-black tracking-tight text-white">Offline Riders</h3>
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 shadow-2xl shadow-black/40">
            {offlineRiders.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] backdrop-blur-lg rounded-2xl transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/[0.04] backdrop-blur-xl flex items-center justify-center font-black italic text-zinc-300 text-xs">
                    {r.name?.[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-400 flex items-center gap-1.5">{r.name} <PayModelBadge paymentModel={r.payment_model} /></h3>
                    <div className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">{r.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenRider && (
                    <button onClick={() => onOpenRider(r.id)} className="hidden group-hover:block text-[9px] text-zinc-500 hover:text-white font-bold px-2 py-1 rounded-lg bg-white/5 transition-all">
                      Profile
                    </button>
                  )}
                  <div className="w-2 h-2 rounded-full bg-zinc-700/80" />
                </div>
              </div>
            ))}
            {offlineRiders.length === 0 && (
              <div className="p-4 text-center text-xs font-bold text-zinc-400">Everyone is online!</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = async () => {
    try {
      const d = await api.get("/admin/inventory");
      setItems(d.ingredients ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useSocketRefresh(['inventory_updated'], load);

  const updateStock = async (id: string, current: number, delta: number) => {
    await api.patch(`/admin/inventory/${id}`, { current_stock: current + delta });
    load();
    toast.success("Stock updated");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Inventory</h2>
          <p className="text-zinc-400 text-sm font-medium">Manage ingredient stock levels.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2.5 rounded-xl bg-swish-green/15 text-swish-green text-[10px] font-black uppercase tracking-widest hover:bg-swish-green hover:text-black transition-all shadow-xl shadow-swish-green/20"
        >
          Add Ingredient
        </button>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <div key={item.id} className={`bg-white/[0.03] backdrop-blur-2xl border rounded-[32px] p-8 shadow-2xl shadow-black/40 ${Number(item.current_stock) <= Number(item.reorder_threshold) ? "border-red-100 bg-red-50/10" : "border-white/10"}`}>
              <div className="mb-6">
                <h3 className="text-xl font-black italic tracking-tighter mb-1 text-white">{item.name}</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.unit}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-black tracking-tighter text-white text-white">{item.current_stock}</div>
                <div className="flex gap-2">
                  <button onClick={() => updateStock(item.id, Number(item.current_stock), -1)} className="w-10 h-10 rounded-xl bg-white/[0.04] backdrop-blur-xl flex items-center justify-center">—</button>
                  <button onClick={() => updateStock(item.id, Number(item.current_stock), 1)} className="w-10 h-10 rounded-xl bg-swish-green/15 text-swish-green flex items-center justify-center hover:bg-swish-green">+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Ingredient Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black tracking-tight text-white">New Ingredient</h3>
                  <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-white/[0.04] backdrop-blur-xl flex items-center justify-center text-zinc-400 hover:bg-zinc-700/80">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    await api.post("/admin/inventory", {
                      name: formData.get("name"),
                      unit: formData.get("unit"),
                      current_stock: parseInt(formData.get("current_stock") as string, 10),
                      reorder_threshold: parseInt(formData.get("reorder_threshold") as string, 10),
                    });
                    setShowAddModal(false);
                    load();
                    toast.success("Ingredient added");
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Name</label>
                      <input name="name" required placeholder="e.g. Tomato Paste" className="w-full px-5 py-3 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Unit</label>
                      <input name="unit" required placeholder="e.g. kg, liters, units" className="w-full px-5 py-3 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Initial Stock</label>
                      <input name="current_stock" type="number" required defaultValue={0} className="w-full px-5 py-3 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Low Threshold</label>
                      <input name="reorder_threshold" type="number" required defaultValue={10} className="w-full px-5 py-3 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white" />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-4 rounded-2xl bg-swish-green/15 text-swish-green font-black text-[10px] uppercase tracking-[0.2em] hover:bg-swish-green hover:text-black transition-all shadow-xl shadow-black/20 mt-4">
                    Add Ingredient
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Broadcast Tab ────────────────────────────────────────────────────────────

function BroadcastTab() {
  const [form, setForm] = useState({ title: "", message: "", target: "all", zoneId: "", segment: "all", imageUrl: "", scheduledFor: "" });
  const [sending, setSending] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get("/admin/broadcasts");
      setCampaigns(res.campaigns || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    api.get("/admin/zones").then(d => setZones(d.zones || []));
    fetchCampaigns();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const payload = { 
        ...form, 
        zoneId: form.zoneId || undefined, 
        segment: form.segment === "all" ? undefined : form.segment,
        imageUrl: form.imageUrl || undefined,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined
      };
      const d = await api.post("/admin/broadcast", payload);
      if (d.success) {
        toast.success(payload.scheduledFor ? `Broadcast scheduled for ${d.count} users` : `Broadcast sent to ${d.count} users`);
        setForm({ title: "", message: "", target: "all", zoneId: "", segment: "all", imageUrl: "", scheduledFor: "" });
        fetchCampaigns();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        <div className="mb-8">
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Broadcast</h2>
          <p className="text-zinc-400 text-sm font-medium">Send push notifications to the platform.</p>
        </div>

        <form onSubmit={send} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl shadow-black/40 space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm outline-none focus:ring-2 ring-swish-green/10 text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Message</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm outline-none focus:ring-2 ring-swish-green/10 resize-none text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Rich Media (Image URL) Optional</label>
            <input
              type="url"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm outline-none focus:ring-2 ring-swish-green/10 text-white mb-4"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Audience</label>
            <div className="flex gap-2 mb-4">
              {["all", "customers", "riders", "kitchens"].map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm(f => ({ ...f, target: t }))}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    form.target === t ? "bg-swish-green/15 text-swish-green" : "bg-white/[0.02] backdrop-blur-lg text-zinc-400 hover:bg-white/[0.04] backdrop-blur-xl"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Target Zone</label>
                <select
                  value={form.zoneId}
                  onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm outline-none focus:ring-2 ring-swish-green/10 text-white appearance-none"
                >
                  <option value="" className="bg-zinc-900">Global (All Zones)</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id} className="bg-zinc-900">{z.name} - {z.city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Behavioral Segment</label>
                <select
                  value={form.segment}
                  onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm outline-none focus:ring-2 ring-swish-green/10 text-white appearance-none"
                >
                  <option value="all" className="bg-zinc-900">All Active Users</option>
                  <option value="inactive_30_days" className="bg-zinc-900">Sleeping (No orders in 30d)</option>
                  <option value="high_rollers" className="bg-zinc-900">VIP Whales (Spent &gt; ₹5,000)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Schedule For (Optional)</label>
              <input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={e => setForm(f => ({ ...f, scheduledFor: e.target.value }))}
                className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-sm outline-none focus:ring-2 ring-swish-green/10 text-white [color-scheme:dark]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full bg-swish-green/15 text-swish-green py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-swish-green hover:text-black transition-all flex items-center justify-center gap-3"
          >
            {sending ? <div className="w-4 h-4 border-2 border-swish-green border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> {form.scheduledFor ? 'Schedule Broadcast' : 'Send Broadcast'}</>}
          </button>
        </form>
      </div>

      <div>
        <div className="mb-8">
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Campaigns</h2>
          <p className="text-zinc-400 text-sm font-medium">History of marketing broadcasts.</p>
        </div>
        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] p-6">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${c.status === 'scheduled' ? 'bg-orange-500/20 text-orange-400' : 'bg-swish-green/20 text-swish-green'}`}>
                  {c.status}
                </span>
                <span className="text-xs text-zinc-500 font-bold tracking-tight">
                  {c.scheduled_for ? new Date(c.scheduled_for).toLocaleString() : new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <h4 className="text-xl font-bold text-white mb-1">{c.title}</h4>
              <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{c.message}</p>
              
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/[0.02] rounded-xl p-3">
                <div className="flex flex-col gap-1">
                  <span>Target: {c.target_audience}</span>
                  {c.zone_name && <span>Zone: {c.zone_name}</span>}
                  {c.segment && <span>Segment: {c.segment}</span>}
                </div>
                <div className="ml-auto text-right">
                  <span className="text-swish-green text-lg">{c.queued_count}</span>
                  <br />Recipients
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="py-12 text-center text-zinc-500 text-sm font-medium">No campaigns found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Support Tab ──────────────────────────────────────────────────────────────

function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const load = async () => {
    try {
      const d = await api.get("/admin/support/tickets");
      setTickets(d.tickets ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useSocketRefresh(['new_ticket', 'ticket_customer_reply', 'ticket_rider_reply'], load);

  const resolve = async (id: string) => {
    if (!resolution) return;
    await api.post(`/admin/support/tickets/${id}/resolve`, { resolution });
    setResolvingId(null);
    setResolution("");
    load();
    toast.success("Ticket resolved");
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Support</h2>
        <p className="text-zinc-400 text-sm font-medium">Customer queries and complaints.</p>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : tickets.length === 0 ? (
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] p-16 text-center shadow-2xl shadow-black/40">
          <div className="flex items-center justify-center mb-4"><CheckCircle2 className="w-14 h-14 text-green-400" /></div>
          <p className="text-white font-black italic tracking-tighter text-2xl mb-2">All Clear!</p>
          <p className="text-zinc-400 text-sm font-medium">No open support tickets. Customers are happy.</p>
        </div>
      ) : null}

      <div className="grid gap-6">
        {tickets.map(t => (
          <div key={t.id} className={`bg-white/[0.03] backdrop-blur-2xl border rounded-[32px] p-8 shadow-2xl shadow-black/40 ${t.status === "open" ? "border-swish-green/20" : "border-white/10 opacity-60"}`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <h3 className="text-2xl font-black italic tracking-tighter text-white">{t.customer_name}</h3>
                   <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${t.status === "open" ? "bg-swish-green/15 text-swish-green" : "bg-white/[0.04] backdrop-blur-xl text-zinc-400"}`}>
                     {t.status}
                   </span>
                </div>
                <p className="text-zinc-400 font-bold text-sm leading-relaxed">{t.subject}</p>
              </div>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>

            <p className="text-zinc-400 text-xs mb-8 whitespace-pre-wrap">{t.description}</p>

            {t.status === "open" && (
              <div className="pt-6 border-t border-white/10 flex gap-4">
                <input
                  type="text"
                  placeholder="Enter resolution notes..."
                  value={resolvingId === t.id ? resolution : ""}
                  onChange={e => { setResolvingId(t.id); setResolution(e.target.value); }}
                  className="flex-1 px-5 py-3.5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 font-bold text-xs outline-none focus:ring-2 ring-swish-green/10 text-white"
                />
                <button onClick={() => resolve(t.id)} className="bg-swish-green/15 text-swish-green px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-swish-green transition-all shadow-xl">
                  Resolve
                </button>
              </div>
            )}
            
            {t.status === "resolved" && (
              <div className="p-4 bg-white/[0.02] backdrop-blur-lg rounded-2xl border border-white/10">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Resolution</p>
                <p className="text-xs font-bold text-zinc-300">{t.resolution}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payouts Tab ──────────────────────────────────────────────────────────────

function PayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await api.get("/admin/payouts/pending");
      setPayouts(d.payouts ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    await api.post(`/admin/payouts/${id}/approve`, {});
    load();
    toast.success("Payout approved");
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Payouts</h2>
        <p className="text-zinc-400 text-sm font-medium">Pending rider settlements.</p>
      </div>

      {loading ? (
        <SkeletonList rows={2} />
      ) : payouts.length === 0 ? (
        <div className="py-20 text-center bg-white/[0.02] backdrop-blur-lg rounded-[40px] border border-white/10 border-dashed">
          <Wallet className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">No pending payouts</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {payouts.map(p => (
            <div key={p.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex items-center justify-between shadow-2xl shadow-black/40">
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 rounded-[24px] bg-swish-green/10 flex items-center justify-center text-swish-green shrink-0">
                  <Wallet className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic tracking-tighter mb-1 text-white">{p.rider_name}</h3>
                  <div className="flex items-center gap-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    <span>{p.rider_phone}</span>
                    <span className="w-1 h-1 bg-zinc-700/80 rounded-full" />
                    <span>Period: {new Date(p.week_start).toLocaleDateString()} — {new Date(p.week_end).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Net Payout</p>
                  <p className="text-3xl font-black tracking-tighter italic text-swish-green">₹{p.net_amount_paise / 100}</p>
                </div>
                <button onClick={() => approve(p.id)} className="bg-swish-green/15 text-swish-green px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-swish-green transition-all shadow-2xl active:scale-95">
                  Approve & Pay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [stats, setStats] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      api.get("/admin/dashboard").catch(() => null),
      api.get("/admin/feedback").catch(() => null),
    ]).then(([s, f]) => {
      if (s) setStats(s);
      if (f) setFeedback(f);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocketRefresh(['new_feedback', 'new_order', 'order_status_update'], load);

  const cards = [
    { label: "Today's Revenue", value: stats ? `₹${((stats?.todayRevenuePaise ?? 0) / 100).toLocaleString("en-IN")}` : "₹0", icon: TrendingUp, desc: "Total collected today" },
    { label: "Active Orders", value: stats ? String(stats.activeOrders ?? 0) : "0", icon: ShoppingBag, desc: "Orders in pipeline" },
    { label: "Riders Online", value: stats ? String(stats.ridersOnline ?? 0) : "0", icon: Bike, desc: "Ready for dispatch" },
    { label: "Stock Alerts", value: stats ? String(stats.lowStockAlerts ?? 0) : "0", icon: AlertCircle, desc: "Items below threshold" },
    { label: "Avg Rating", value: feedback?.averageRating && parseFloat(feedback.averageRating) > 0 ? `${feedback.averageRating} ★` : "4.8 ★", icon: Star, desc: "Food quality rating" },
    { label: "Delivery ETA", value: "18-24 min", icon: Clock, desc: "Avg delivery time" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Analytics</h2>
        <p className="text-zinc-400 text-sm font-medium">Real-time platform metrics.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-36 rounded-[28px] bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((m, i) => (
            <div key={i} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 shadow-2xl shadow-black/40">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] backdrop-blur-xl flex items-center justify-center text-zinc-400 mb-4">
                <m.icon className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black tracking-tighter text-white mb-1">{m.value}</div>
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.25em] mb-1">{m.label}</div>
              <div className="text-xs text-zinc-400 font-medium">{m.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

const FEATURE_FLAGS = ["feature_online_payments","feature_cod","feature_wallet","feature_subscriptions","feature_referrals","feature_loyalty","feature_scheduling","feature_live_kitchen","maintenance_mode","force_update","auto_dispatch_enabled"];
const BUSINESS_RULES = ["min_order_paise","platform_fee_percent","max_delivery_radius_km","surge_order_threshold","wallet_cashback_cap_paise","kitchen_auto_close_time","min_app_version","latest_app_version","support_contact","max_batch_size"];

function SettingsTab() {
  const [settings, setSettings] = useState<Record<string,any>>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await api.get("/admin/settings");
      const map: Record<string,any> = {};
      (data.settings ?? []).forEach((s: any) => { map[s.key] = s; });
      setSettings(map);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useSocketRefresh(['settings_updated'], load);

  const patch = async (key: string, value: string) => {
    setSaving(true);
    try {
      await api.patch(`/admin/settings/${key}`, { value });
      toast.success("Saved");
      load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); setEditingKey(null); }
  };

  const toggleFlag = async (key: string) => {
    const cur = settings[key]?.value === "true";
    await patch(key, String(!cur));
  };

  const label = (key: string) => key.replace(/^feature_/, "").replace(/_/g, " ");

  if (loading) return <SkeletonList rows={5} />;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Settings</h2>
        <p className="text-zinc-400 text-sm">Changes take effect instantly — no redeploy needed.</p>
      </div>

      {/* Landing Page Configuration */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Landing Page</p>
        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl">
          <p className="text-sm font-semibold text-white mb-1">Hero Images Carousel</p>
          <p className="text-xs text-zinc-500 mb-4">Recommended Size: 1000x1250 pixels (4:5 aspect ratio). Images will automatically slide on the main landing page.</p>
          
          {(() => {
            let images: string[] = [];
            const rawVal = settings["landing_hero_image"]?.value;
            if (rawVal) {
              try {
                const parsed = JSON.parse(rawVal);
                images = Array.isArray(parsed) ? parsed : (typeof parsed === 'string' ? [parsed] : []);
              } catch (e) {
                images = [rawVal.replace(/"/g, '')];
              }
            }
            return (
              <div className="flex flex-col gap-4">
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {images.map((img: string, idx: number) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Hero ${idx}`} className="w-16 h-20 object-cover rounded-xl border border-white/10" />
                        <button 
                          onClick={async () => {
                            const newImages = images.filter((_, i) => i !== idx);
                            await api.patch("/admin/settings/landing_hero_image", { value: JSON.stringify(newImages) });
                            load();
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  disabled={saving}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSaving(true);
                    const toastId = toast.loading("Uploading image...");
                    try {
                      const uploadRes = await api.uploadImage(file);
                      if (uploadRes.url) {
                        const newImages = [...images, uploadRes.url];
                        await api.patch("/admin/settings/landing_hero_image", { value: JSON.stringify(newImages) });
                        toast.success("Hero image added to carousel", { id: toastId });
                        load();
                      } else {
                        throw new Error("Upload failed");
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Failed to upload", { id: toastId });
                    } finally {
                      setSaving(false);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-white/[0.04] file:text-white hover:file:bg-zinc-700/80 cursor-pointer"
                />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Feature Flags */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Feature Flags</p>
        <div className="space-y-2">
          {FEATURE_FLAGS.map(key => {
            const s = settings[key];
            const isOn = s?.value === "true";
            return (
              <div key={key} className="flex items-center justify-between px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-white capitalize">{label(key)}</p>
                  {s?.description && <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>}
                </div>
                <button onClick={() => toggleFlag(key)} className="flex items-center gap-2 text-sm">
                  {isOn
                    ? <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold">● ON</span>
                    : <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-500 text-xs font-semibold">○ OFF</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Business Rules */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Business Rules</p>
        <div className="space-y-2">
          {BUSINESS_RULES.map(key => {
            const s = settings[key];
            if (!s) return null;
            return (
              <div key={key} className="flex items-center justify-between px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl">
                <div className="flex-1 mr-4 min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-0.5">{label(key)}</p>
                  {editingKey === key ? (
                    <input
                      autoFocus
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") patch(key, editVal); if (e.key === "Escape") setEditingKey(null); }}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-lg px-2 py-1 font-bold text-sm text-white focus:outline-none focus:border-white/20"
                    />
                  ) : (
                    <p className="font-bold text-sm text-white truncate">{s.value}</p>
                  )}
                  {s.description && <p className="text-[10px] text-zinc-600 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {editingKey === key ? (
                    <>
                      <button onClick={() => setEditingKey(null)} className="px-3 py-1.5 rounded-xl bg-white/[0.04] text-xs font-bold text-zinc-400 hover:bg-zinc-700/80">Cancel</button>
                      <button disabled={saving} onClick={() => patch(key, editVal)} className="px-3 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-100 disabled:opacity-50">Save</button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingKey(key); setEditVal(s.value); }} className="px-4 py-2 rounded-xl bg-white/[0.04] text-xs font-black uppercase tracking-widest hover:bg-zinc-700/80 text-white">Edit</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice Customization Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-0.5">Invoice & Billing Customizer</p>
            <p className="text-xs text-zinc-500">Customize header, company details, GSTIN, and footer for all customer PDF invoices.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "invoice_company_name", label: "Company Name", placeholder: "e.g. 2QT FOOD PALACE PRIVATE LIMITED" },
            { key: "invoice_subtitle", label: "Invoice Subtitle / Tagline", placeholder: "e.g. Fulfilled by Central Kitchen" },
            { key: "invoice_company_address", label: "Header Address", placeholder: "e.g. Kundanahalli Central, Bengaluru" },
            { key: "invoice_gstin", label: "GSTIN Number", placeholder: "e.g. 29ABCDE1234F1Z5" },
            { key: "invoice_fssai", label: "FSSAI License No.", placeholder: "e.g. 11223344556677" },
            { key: "invoice_support_phone", label: "Support Phone", placeholder: "e.g. +91-8800000000" },
            { key: "invoice_support_email", label: "Support Email", placeholder: "e.g. support@2qt.app" },
            { key: "invoice_primary_color", label: "Theme Accent Color (Hex)", placeholder: "e.g. #10B981" },
            { key: "invoice_footer_text", label: "Footer Thank You Note", placeholder: "e.g. Thank you for choosing 2QT! We hope you enjoyed your meal.", fullWidth: true },
          ].map(field => {
            const val = settings[field.key]?.value ?? "";
            return (
              <div key={field.key} className={`p-4 bg-white/[0.03] border border-white/10 rounded-2xl ${field.fullWidth ? 'md:col-span-2' : ''}`}>
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">{field.label}</p>
                {editingKey === field.key ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      placeholder={field.placeholder}
                      className="flex-1 bg-white/[0.04] border border-white/20 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button disabled={saving} onClick={() => patch(field.key, editVal)} className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400">Save</button>
                    <button onClick={() => setEditingKey(null)} className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold text-zinc-400">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-white truncate">{val || <span className="text-zinc-600 font-normal italic">Default: {field.placeholder}</span>}</p>
                    <button onClick={() => { setEditingKey(field.key); setEditVal(val); }} className="px-3 py-1.5 rounded-xl bg-white/[0.04] text-xs font-black uppercase tracking-widest hover:bg-white/10 text-white ml-2">Edit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Backend node info */}
      <div className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/10 rounded-2xl border-dashed">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Backend Node</div>
          <div className="font-bold text-sm text-zinc-400">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1"}</div>
        </div>
        <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-400 text-[8px] font-black uppercase tracking-widest">Connected</span>
      </div>
    </div>
  );
}

// ─── Systems Tab ──────────────────────────────────────────────────────────────

function SystemsTab() {
  const [status, setStatus] = useState<any>(null);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    const d = await api.get("/admin/jobs/status");
    setStatus(d);
  };

  useEffect(() => { load(); }, []);

  const clearFailed = async () => {
    setClearing(true);
    await api.post("/admin/jobs/clear-failed", {});
    await load();
    setClearing(false);
    toast.success("Failed jobs cleared");
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Systems</h2>
        <p className="text-zinc-400 text-sm font-medium">Operational health and background tasks.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] backdrop-blur-lg flex items-center justify-center text-zinc-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black italic tracking-tighter text-white">Job Queues</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">BullMQ / Redis</p>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { label: "Invoice Generation", count: status?.invoices ?? 0 },
              { label: "SMS Notifications", count: status?.notifications ?? 0 },
            ].map((q, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-300">{q.label}</span>
                <span className="px-3 py-1 rounded-lg bg-white/[0.04] backdrop-blur-xl text-white text-xs font-black tracking-tighter">{q.count} pending</span>
              </div>
            ))}
          </div>

          <button
            onClick={clearFailed}
            disabled={clearing}
            className="w-full mt-10 py-4 rounded-2xl bg-red-50 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
          >
            Clear Failed Jobs
          </button>
        </div>

        <div className="bg-zinc-900 rounded-[32px] p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] backdrop-blur-2xl/5 flex items-center justify-center text-white/20">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black italic tracking-tighter text-white">Core Engine</h3>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Node.js / Express</p>
            </div>
          </div>
          
          <div className="space-y-4">
             <div className="p-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl/5 border border-white/10">
                <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Environment</div>
                <div className="text-sm font-bold text-swish-green">Production Protocol</div>
             </div>
             <div className="p-4 rounded-2xl bg-white/[0.03] backdrop-blur-2xl/5 border border-white/10">
                <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Socket Status</div>
                <div className="text-sm font-bold text-white">Active Persistence</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiderApplicationsTab() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, action: 'approve' | 'reject' | null, id: string | null}>({ isOpen: false, action: null, id: null });

  const load = async () => {
    try {
      const d = await api.getAdminRiderApplications();
      setApps(d.applications ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useSocketRefresh(['new_rider_application'], load);

  const handleActionClick = (id: string, action: 'approve' | 'reject') => {
    setConfirmDialog({ isOpen: true, action, id });
  };

  const processAction = async () => {
    const { id, action } = confirmDialog;
    setConfirmDialog({ isOpen: false, action: null, id: null });
    if (!id || !action) return;
    
    try {
      await api.actionAdminRiderApplication(id, action);
      toast.success(`Application ${action}d`);
      load();
    } catch (e) {
      toast.error(`Failed to ${action} application`);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500 mb-2">Rider Onboarding</h2>
          <p className="text-zinc-400 text-base font-medium">Review and manage pending driver applications for the 2QT fleet.</p>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white/[0.01] border border-white/5 rounded-[40px] backdrop-blur-2xl">
          <div className="w-24 h-24 bg-white/[0.02] rounded-[32px] flex items-center justify-center mb-6">
            <Bike size={40} className="text-zinc-500 opacity-50" />
          </div>
          <div className="text-zinc-300 font-black text-xl tracking-tight mb-2">Inbox Zero</div>
          <p className="text-zinc-500 text-sm font-medium">No pending rider applications at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {apps.map(app => {
            const displayName = app.name.replace(/2QT/gi, "2QT");
            return (
              <div key={app.id} className="group relative bg-zinc-900/40 hover:bg-zinc-900/80 backdrop-blur-2xl border border-white/5 hover:border-white/10 rounded-[32px] p-8 shadow-2xl transition-all duration-500 flex flex-col justify-between overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] -z-10 group-hover:bg-brand-primary/20 transition-all duration-500" />
                
                <div className="flex items-start justify-between mb-8 z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-inner overflow-hidden">
                      {app.photo_url ? (
                        <img src={app.photo_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400">
                          {displayName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-2xl tracking-tight mb-1">{displayName}</h3>
                      <p className="text-brand-primary font-bold text-sm tracking-wide">{app.phone}</p>
                    </div>
                  </div>
                  <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg ${
                    app.status === 'pending' 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                      : app.status === 'approved' 
                      ? 'bg-swish-green/10 text-swish-green border border-swish-green/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {app.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-8 p-4 bg-black/40 rounded-[20px] border border-white/5 z-10">
                  <div className="flex-1">
                    <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">Vehicle</p>
                    <p className="text-zinc-200 text-sm font-semibold capitalize flex items-center gap-2">
                      <Bike size={14} className="text-zinc-400" /> {app.vehicle_type}
                    </p>
                  </div>
                  <div className="w-[1px] h-8 bg-white/10" />
                  <div className="flex-1">
                    <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">License ID</p>
                    <p className="text-zinc-200 text-sm font-semibold font-mono">{app.license_number}</p>
                  </div>
                  {app.id_photo_url && (
                    <>
                      <div className="w-[1px] h-8 bg-white/10" />
                      <div className="flex-1">
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">Document</p>
                        <a href={app.id_photo_url} target="_blank" rel="noreferrer" className="text-brand-primary text-sm font-semibold flex items-center gap-1 hover:underline">
                          View ID
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-4 z-10">
                    <button 
                      onClick={() => handleActionClick(app.id, 'reject')} 
                      className="w-full py-4 rounded-[20px] bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white font-bold tracking-wide transition-all duration-300 border border-red-500/10 hover:border-red-500 flex items-center justify-center gap-2"
                    >
                      <XCircle size={20} /> Reject
                    </button>
                    <button 
                      onClick={() => handleActionClick(app.id, 'approve')} 
                      className="w-full py-4 rounded-[20px] bg-swish-green/5 hover:bg-swish-green text-swish-green hover:text-black font-bold tracking-wide transition-all duration-300 border border-swish-green/10 hover:border-swish-green flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,208,132,0.1)] hover:shadow-[0_0_30px_rgba(0,208,132,0.4)]"
                    >
                      <CheckCircle2 size={20} /> Approve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'approve' ? 'Approve Application?' : 'Reject Application?'}
        message={
          confirmDialog.action === 'approve'
            ? 'Are you sure you want to approve this rider application? They will gain access to the rider app and start receiving delivery requests.'
            : 'Are you sure you want to reject this application? This action cannot be undone.'
        }
        confirmText={confirmDialog.action === 'approve' ? 'Approve Rider' : 'Reject Rider'}
        onConfirm={processAction}
        onCancel={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
        isDanger={confirmDialog.action === 'reject'}
      />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS = [
  // Core
  { name: "Overview",        icon: LayoutDashboard, component: OverviewTab },
  { name: "Analytics",       icon: BarChart3,        component: AnalyticsTab },
  // Orders & Fleet
  { name: "Orders",          icon: ShoppingBag,      component: OrdersTab },
  { name: "Scheduled",       icon: Calendar,         component: ScheduledTab },
  { name: "Dispatch",        icon: Package,          component: DispatchTab },
  { name: "Fleet",           icon: Bike,             component: FleetTab },
  { name: "Applications",    icon: Info,             component: RiderApplicationsTab },
  { name: "Rider Docs",      icon: ShieldCheck,      component: RiderDocumentsTab },
  { name: "Rider Issues",    icon: FileWarning,      component: RiderIssuesTab },
  { name: "SOS Alerts",      icon: ShieldAlert,      component: SOSAlertsTab },
  { name: "Deliveries",      icon: CheckSquare,      component: DeliveredOrdersTab },
  // Restaurants
  { name: "Restaurants",     icon: Utensils,         component: RestaurantsTab },
  { name: "Kitchens",        icon: Store,            component: KitchensTab },
  { name: "Partners",        icon: Store,            component: PartnersTab },
  { name: "Menu",            icon: Utensils,         component: MenuTab },
  { name: "Categories",      icon: LayoutGrid,       component: CategoriesTab },
  { name: "Inventory",       icon: Box,              component: InventoryTab },
  // Growth
  { name: "Broadcast",       icon: Send,             component: BroadcastTab },
  { name: "Campaigns",       icon: Zap,              component: CampaignsTab },
  { name: "Promo Codes",     icon: Ticket,           component: PromoCodesTab },
  { name: "Menu Offers",     icon: Tag,              component: MenuOffersTab },
  { name: "Marketing",       icon: Camera,           component: MarketingTab },
  { name: "Pre-Launch",      icon: Rocket,           component: PreLaunchTab },
  // Customers
  { name: "Customers",       icon: Users,            component: CustomersTab },
  { name: "Ratings",         icon: Star,             component: RatingsTab },
  { name: "Support",         icon: LifeBuoy,         component: SupportTab },
  { name: "Complaints",      icon: AlertTriangle,    component: ComplaintsTab },
  // Platform
  { name: "Zones",           icon: MapPin,           component: ZonesTab },
  { name: "Order Capacity",  icon: Layers,           component: ZoneCapacityTab },
  { name: "Missions",        icon: Trophy,           component: MissionsTab },
  { name: "Delivery Pricing",icon: Receipt,          component: DeliveryPricingTab },
  { name: "Kitchen Health",  icon: Activity,         component: KitchenHealthTab },
  { name: "Rider Payouts",   icon: Wallet,           component: PayoutsTab },
  { name: "Notifications",   icon: Bell,             component: NotificationsTab },
  { name: "Activity Log",    icon: Clock,            component: ActivityTab },
  { name: "Team",            icon: Users,            component: TeamTab },
  { name: "Systems",         icon: Cpu,              component: SystemsTab },
  { name: "Settings",        icon: Settings,         component: SettingsTab },
];

function AdminDashboard() {
  const { user, loading, logout } = useAuth()!;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [openRiderId, setOpenRiderId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.push("/admin/login");
      return;
    } 
    
    if (!["super_admin", "admin"].includes(user.role)) {
      router.push("/menu");
      return;
    }

    // Initialize Socket
    socket.connect();

    socket.on("new_order", (data) => {
      toast.success(`New Order #${data.display_id} received!`, {
        icon: <ShoppingBag className="w-4 h-4 text-swish-green" />,
        description: "Dashboard updated in real-time."
      });
      setRefreshKey(prev => prev + 1);
    });

    socket.on("order_status_update", (data) => {
      setRefreshKey(prev => prev + 1);
    });

    socket.on("new_ticket", (data) => {
      toast.info(`New Support Ticket from ${data.ticket.customer_name}`, {
        icon: <Users className="w-4 h-4 text-blue-500" />
      });
      setRefreshKey(prev => prev + 1);
    });

    socket.on("sos_alert", (data) => {
      const typeLabel = data.alertType === 'emergency' ? '🚨 EMERGENCY' : data.alertType === 'silent' ? '🤫 Silent Alert' : '📍 Location Share';
      toast.error(`${typeLabel} — ${data.riderName || 'Unknown rider'}`, {
        description: `Phone: ${data.riderPhone || 'N/A'} · Tap Safety Alerts tab`,
        duration: 15000,
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
      });
      setActiveTab("SOS Alerts");
    });

    socket.on("critical_alert", (data) => {
      toast.error(`Critical Alert: ${data.type || 'System Alert'}`, {
        description: data.message || 'A critical system event requires attention.',
        duration: 15000,
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      });
      setRefreshKey(prev => prev + 1);
    });

    socket.on("kitchen_complaint_spike", (data) => {
      toast.warning(`Complaint Spike: ${data.kitchenName || 'Kitchen'}`, {
        description: `${data.count || 'Multiple'} complaints received. Check kitchen performance.`,
        duration: 10000,
      });
      setRefreshKey(prev => prev + 1);
    });

    socket.on("order_needs_manual_assignment", (data) => {
      toast.warning(`Order needs manual assignment`, {
        description: `Order #${data.displayId || data.orderId} has no available rider. Assign manually.`,
        duration: 20000,
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      });
      setRefreshKey(prev => prev + 1);
    });

    return () => {
      socket.off("new_order");
      socket.off("order_status_update");
      socket.off("new_ticket");
      socket.off("sos_alert");
      socket.off("critical_alert");
      socket.off("kitchen_complaint_spike");
      socket.off("order_needs_manual_assignment");
      socket.disconnect();
    };
  }, [user, router]);

  const ActiveComponent = TABS.find(t => t.name === activeTab)?.component ?? OverviewTab;
  
  // Pass refreshKey to trigger re-fetches in tabs
  const componentKey = `${activeTab}-${refreshKey}`;

  return (
    <div className="h-screen w-full overflow-hidden bg-[#07070e] flex font-sans selection:bg-brand-primary/30 relative">
      {/* ── Sidebar ── */}
      <aside className="w-[240px] bg-[#0a0a14] border-r border-white/[0.05] flex flex-col sticky top-0 h-screen z-20 shrink-0">
        {/* Logo */}
        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="text-lg font-black tracking-tight text-white leading-none">
              2QT<span className="text-brand-primary">.</span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-3 overflow-y-auto pb-4 scrollbar-hide">
          {[
            { section: "Core",           items: ["Overview", "Analytics"] },
            { section: "Orders & Fleet", items: ["Orders", "Scheduled", "Dispatch", "Deliveries", "Fleet", "Applications", "Rider Docs", "Rider Issues", "SOS Alerts"] },
            { section: "Restaurants",    items: ["Restaurants", "Kitchens", "Partners", "Menu", "Categories", "Inventory"] },
            { section: "Growth",         items: ["Broadcast", "Campaigns", "Promo Codes", "Menu Offers", "Marketing", "Pre-Launch"] },
            { section: "Customers",      items: ["Customers", "Support", "Complaints"] },
            { section: "Platform",       items: ["Zones", "Order Capacity", "Missions", "Delivery Pricing", "Kitchen Health", "Rider Payouts", "Notifications", "Activity Log", "Team", "Systems", "Settings"] },
          ].map(group => {
            const visibleItems = sidebarSearch
              ? group.items.filter(n => n.toLowerCase().includes(sidebarSearch.toLowerCase()))
              : group.items;
            if (sidebarSearch && visibleItems.length === 0) return null;
            const isCollapsed = collapsedSections.has(group.section) && !sidebarSearch;
            return (
              <div key={group.section} className="mt-5 first:mt-0">
                <button
                  onClick={() => setCollapsedSections(prev => {
                    const next = new Set(prev);
                    next.has(group.section) ? next.delete(group.section) : next.add(group.section);
                    return next;
                  })}
                  className="w-full flex items-center justify-between px-3 mb-1 group"
                >
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">{group.section}</span>
                  <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {visibleItems.map(name => {
                      const tab = TABS.find(t => t.name === name);
                      if (!tab) return null;
                      const isActive = activeTab === name;
                      return (
                        <button
                          key={name}
                          onClick={() => { setActiveTab(name); setSidebarSearch(""); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                            isActive ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                          }`}
                        >
                          <tab.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-primary" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                          <span className="flex-1 text-left">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-5 pt-4 border-t border-white/[0.05] px-3">
            <button
              onClick={() => toast.info("Keyboard shortcuts modal coming soon!")}
              className="w-full flex items-center justify-between py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <span className="flex items-center gap-2"><Command className="w-4 h-4" /> Shortcuts</span>
              <span className="text-[10px] bg-white/[0.05] px-1.5 py-0.5 rounded font-mono">⌘K</span>
            </button>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 m-4 bg-[#11111a] border border-white/[0.05] rounded-2xl flex items-center justify-between group cursor-pointer hover:border-white/[0.1] transition-colors" onClick={() => { logout(); router.push("/"); }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center font-bold text-white text-xs">
              {user?.name?.[0] ?? "A"}
            </div>
            <div>
              <div className="font-semibold text-sm text-white">{user?.name?.split(' ')[0] || 'Admin'}</div>
            </div>
          </div>
          <LogOut className="w-4 h-4 text-zinc-600 group-hover:text-red-400 transition-colors" />
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto scrollbar-hide">
        
        {/* Top Header Bar */}
        <header className="h-16 px-8 border-b border-white/[0.05] flex items-center justify-between bg-[#07070e]/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center w-full max-w-md relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search tabs..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sidebarSearch.trim()) {
                  const match = TABS.find(t => t.name.toLowerCase().includes(sidebarSearch.toLowerCase()));
                  if (match) { setActiveTab(match.name); setSidebarSearch(""); }
                  else toast.info("No matching tab found");
                }
                if (e.key === 'Escape') setSidebarSearch("");
              }}
              className="w-full bg-[#11111a] border border-white/[0.05] rounded-lg pl-10 pr-12 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
            />
            {sidebarSearch ? (
              <button onClick={() => setSidebarSearch("")} className="absolute right-3 text-zinc-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-3 flex gap-1">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white/[0.05] rounded font-mono text-zinc-500 border border-white/[0.05]">⌘</kbd>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white/[0.05] rounded font-mono text-zinc-500 border border-white/[0.05]">K</kbd>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => toast.info("No new notifications")}
              className="relative w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#07070e]" />
            </button>
            <div className="w-px h-6 bg-white/[0.1]" />
            <div 
              onClick={() => {
                toast.success("Logging out...");
                setTimeout(() => { logout(); router.push("/"); }, 1000);
              }}
              className="flex items-center gap-2 cursor-pointer hover:bg-white/[0.05] p-1 pr-2 rounded-full transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs">
                {user?.name?.[0] ?? "A"}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </div>
          </div>
        </header>

        {/* Hierarchical Operational Scope Header Bar */}
        <AdminScopeHeader />

        {/* Dynamic Tab Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={componentKey}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === "Rider Docs"
                ? <RiderDocumentsTab onOpenRider={id => setOpenRiderId(id)} />
                : activeTab === "Fleet"
                ? <FleetTab onOpenRider={id => setOpenRiderId(id)} />
                : <ActiveComponent />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Rider Detail Drawer */}
      <AnimatePresence>
        {openRiderId && (
          <RiderDetailDrawer riderId={openRiderId} onClose={() => setOpenRiderId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[#07070e] text-white flex items-center justify-center font-sans">Loading Admin Panel...</div>}>
      <AdminScopeProvider>
        <AdminDashboard />
      </AdminScopeProvider>
    </Suspense>
  );
}
