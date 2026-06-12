"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Users, ShoppingBag, TrendingUp, LayoutDashboard,
  Utensils, Settings, Search, ArrowUpRight, LogOut,
  CheckCircle2, XCircle, RefreshCw, AlertCircle, Bike, Star,
  ToggleLeft, ToggleRight, Send, Clock, Plus, X, Trash2, Edit3,
  Package, Info, ChevronRight, Filter, ChevronDown, Calendar, Box,
  LifeBuoy, Wallet, Download, Activity, Cpu, Camera, ArrowUp, ArrowDown, Zap, Bell, MoreHorizontal, Command, MapPin, Store
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";
import dynamic from "next/dynamic";

const MarketingTab = dynamic(() => import("./MarketingTab").then(m => ({ default: m.MarketingTab })), { ssr: false });
const MenuTab = dynamic(() => import("./MenuTab").then(m => ({ default: m.MenuTab })), { ssr: false });
const ZonesTab = dynamic(() => import("./ZonesTab").then(m => ({ default: m.ZonesTab })), { ssr: false });
const KitchensTab = dynamic(() => import("./KitchensTab").then(m => ({ default: m.KitchensTab })), { ssr: false });

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

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/admin/orders/live"),
      ]);
      setStats(s);
      setLiveOrders(o.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rev = (stats?.todayRevenuePaise ?? 0) / 100;
  const revData = [45, 60, 40, 80, 55, 90, rev > 0 ? 100 : 30]; // 7 days data
  const barColors = ["#ef4444", "#FF6B35", "#10b981", "#3b82f6", "#8b5cf6", "#FF6B35", "#10b981"];

  const statCards = stats ? [
    {
      label: "New Orders", value: stats.activeOrders * 3 + 12,
      trend: "+5.1%", up: true, icon: ShoppingBag,
      iconColor: "text-brand-primary", iconBg: "bg-brand-primary/10",
      trendColor: "text-emerald-400", sparkColor: "#10b981",
      sparkData: [20, 35, 28, 45, 38, 52, 48, 60, 55, 70],
    },
    {
      label: "Active Users", value: "333",
      trend: "+12.5%", up: true, icon: Users,
      iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10",
      trendColor: "text-emerald-400", sparkColor: "#10b981",
      sparkData: [100, 150, 120, 200, 180, 250, 220, 300, 280, 333],
    },
    {
      label: "Riders Online", value: stats.ridersOnline,
      trend: "+1.9%", up: true, icon: Bike,
      iconColor: "text-blue-400", iconBg: "bg-blue-500/10",
      trendColor: "text-emerald-400", sparkColor: "#3b82f6",
      sparkData: [10, 15, 12, 20, 18, 25, 22, 30, 28, stats.ridersOnline > 0 ? 35 : 15],
    },
    {
      label: "Stock Alerts", value: stats.lowStockAlerts,
      trend: "+0.4%", up: false, icon: AlertCircle,
      iconColor: "text-red-400", iconBg: "bg-red-500/10",
      trendColor: "text-red-400", sparkColor: "#ef4444",
      sparkData: [5, 8, 6, 12, 10, 15, 12, 18, 14, stats.lowStockAlerts > 0 ? 20 : 5],
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
              <p className="text-sm font-semibold text-zinc-400 mb-2">Total Revenue (Last 7 Days)</p>
              <h2 className="text-5xl font-black text-white">₹{(rev || 12450).toLocaleString("en-IN")}</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">+18%</span>
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
                <span>7 Day</span><span>Mon</span><span>Tues</span><span>Wed</span><span>Thurs</span><span>Fri</span><span>7 Day</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2x2 Stat Grid */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-6">
          {loading ? [1,2,3,4].map(i => <div key={i} className="bg-white/[0.02] rounded-[20px] animate-pulse" />) : statCards.map((s, i) => (
            <div key={i} className="bg-[#11111a] rounded-[20px] border border-white/[0.05] p-5 flex flex-col justify-between shadow-xl group">
              <div className="flex justify-between items-start mb-2">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
              </div>
              <p className="text-sm font-semibold text-zinc-400 mb-1">{s.label}</p>
              <h3 className="text-3xl font-black text-white mb-2">{s.value}</h3>
              <div className="flex items-end justify-between">
                <span className={`text-[11px] font-bold ${s.trendColor}`}>{s.trend} ↑</span>
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

  useEffect(() => { load(); }, []);

  const handleCancelClick = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  const processCancel = async () => {
    const { id } = confirmDialog;
    setConfirmDialog({ isOpen: false, id: null });
    if (!id) return;
    
    setCancelling(id);
    try {
      await api.post(`/orders/${id}/cancel`, { reason: "Admin cancelled" });
      toast.success("Order cancelled");
      load();
    } finally {
      setCancelling(null);
    }
  };

  const forceStatus = async (id: string, currentStatus: string) => {
    const statusSteps = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"];
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


  const statusSteps = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"];
  const statusColor: Record<string, string> = {
    confirmed: "text-amber-500 bg-amber-500/10",
    preparing: "text-swish-green bg-swish-green/10",
    ready_for_pickup: "text-blue-400 bg-blue-500/10",
    out_for_delivery: "text-purple-400 bg-purple-500/10",
    delivered: "text-zinc-400 bg-white/[0.04] backdrop-blur-xl",
    cancelled: "text-red-400 bg-red-100",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white">Orders</h2>
        <div className="flex items-center gap-4">
          <button onClick={load} className="w-10 h-10 rounded-xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-zinc-400">{orders.length} live orders</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/[0.04] backdrop-blur-xl rounded-[28px] animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-24 text-zinc-300 font-black uppercase tracking-widest text-sm">No live orders right now</div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 shadow-2xl shadow-black/40 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/10 flex items-center justify-center font-black text-base text-white">
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
                  <button
                    onClick={async () => {
                      try {
                        const data = await api.get(`/orders/${order.id}/invoice`);
                        if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank");
                      } catch {
                        toast.error("Invoice failed");
                      }
                    }}
                    className="w-9 h-9 rounded-xl bg-white/[0.02] backdrop-blur-lg border border-white/10 flex items-center justify-center text-zinc-400 hover:text-swish-green hover:border-swish-green/30 transition-all"
                    title="Download Invoice"
                  >
                    <Download className="w-4 h-4" />
                  </button>
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

  useEffect(() => {
    api.get("/admin/orders/scheduled").then(d => {
      setOrders(d.scheduledOrders ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Scheduled</h2>
        <p className="text-zinc-400 text-sm font-medium">Pre-orders and recurring meal plans.</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/[0.04] backdrop-blur-xl rounded-3xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center bg-white/[0.02] backdrop-blur-lg rounded-[40px] border border-white/10 border-dashed">
          <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">No scheduled orders found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map(o => (
            <div key={o.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex items-center justify-between shadow-2xl shadow-black/40 hover:border-white/10 transition-all">
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
              <button className="px-5 py-2.5 rounded-xl bg-swish-green/15 text-swish-green text-[10px] font-black uppercase tracking-widest hover:bg-swish-green transition-all shadow-lg">
                Manage
              </button>
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

  const load = async () => {
    try {
      const d = await api.get("/admin/users");
      setUsers(d.users ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (id: string, current: boolean) => {
    await api.patch(`/admin/users/${id}/status`, { is_active: !current });
    load();
    toast.success("User status updated");
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Customers</h2>
        <p className="text-zinc-400 text-sm font-medium">Platform user database.</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-white/[0.04] backdrop-blur-xl rounded-2xl animate-pulse" />)}</div>
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

function FleetTab() {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const verifiedRiders = riders.filter(r => r.is_verified);
  const onlineRiders = verifiedRiders.filter(r => r.is_online);
  const offlineRiders = verifiedRiders.filter(r => !r.is_online);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Fleet Command</h2>
          <p className="text-zinc-400 text-sm font-medium">Real-time rider tracking and performance metrics.</p>
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
                <button 
                  onClick={() => verifyRider(r.id)}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Verify & Approve
                </button>
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
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-white/[0.04] backdrop-blur-xl rounded-[24px] animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onlineRiders.map(r => (
                <div key={r.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 shadow-2xl shadow-black/40 hover:shadow-2xl hover:shadow-black/60 transition-all relative overflow-hidden">
                  {r.status === "on_delivery" && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-swish-green" />
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/[0.04] backdrop-blur-xl flex items-center justify-center font-black italic text-zinc-400">
                        {r.name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{r.name}</h3>
                        <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.9 • 10 del.
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${r.status === "on_delivery" ? 'bg-swish-green/10 text-swish-green' : 'bg-blue-500/10 text-blue-500'}`}>
                      {r.status?.replace("_", " ") ?? "Idle"}
                    </span>
                  </div>
                  
                  {r.status === "on_delivery" ? (
                    <div className="bg-white/[0.02] backdrop-blur-lg rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Current Order</span>
                         <span className="font-black text-sm text-white">#R-992</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Est. Arrival</span>
                         <span className="font-bold text-swish-green text-sm flex items-center gap-1"><Clock className="w-3 h-3" /> 12 mins</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] backdrop-blur-lg/50 rounded-xl p-4 border border-white/10 border-dashed text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Waiting for dispatch</span>
                    </div>
                  )}
                </div>
              ))}
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
              <div key={r.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] backdrop-blur-lg rounded-2xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/[0.04] backdrop-blur-xl flex items-center justify-center font-black italic text-zinc-300 text-xs">
                    {r.name?.[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-400">{r.name}</h3>
                    <div className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">{r.phone}</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-zinc-700/80" />
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
        <div className="grid grid-cols-2 gap-6">{[1,2,3].map(i => <div key={i} className="h-32 bg-white/[0.04] backdrop-blur-xl rounded-3xl animate-pulse" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <div key={item.id} className={`bg-white/[0.03] backdrop-blur-2xl border rounded-[32px] p-8 shadow-2xl shadow-black/40 ${item.current_stock <= item.reorder_threshold ? "border-red-100 bg-red-50/10" : "border-white/10"}`}>
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
              {["all", "customers", "riders"].map(t => (
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
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-white/[0.04] backdrop-blur-xl rounded-[32px] animate-pulse" />)}</div>
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
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-24 bg-white/[0.04] backdrop-blur-xl rounded-3xl animate-pulse" />)}</div>
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
  
  useEffect(() => {
    api.get("/admin/dashboard").then(setStats);
    api.get("/kitchen/feedback").then(setFeedback);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Analytics</h2>
        <p className="text-zinc-400 text-sm font-medium">Real-time platform metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Today's Revenue", value: stats ? `₹${((stats?.todayRevenuePaise ?? 0) / 100).toLocaleString("en-IN")}` : "—", icon: TrendingUp, desc: "Total collected today" },
          { label: "Active Orders", value: stats?.activeOrders ?? "—", icon: ShoppingBag, desc: "Orders in pipeline" },
          { label: "Riders Online", value: stats?.ridersOnline ?? "—", icon: Bike, desc: "Ready for dispatch" },
          { label: "Stock Alerts", value: stats?.lowStockAlerts ?? "—", icon: AlertCircle, desc: "Items below threshold" },
          { label: "Avg Rating", value: feedback?.averageRating ?? "—", icon: Star, desc: "Food quality rating" },
          { label: "Delivery ETA", value: "14 min", icon: Clock, desc: "Average this week" },
        ].map((m, i) => (
          <div key={i} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 shadow-2xl shadow-black/40">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] backdrop-blur-xl flex items-center justify-center text-zinc-400 mb-4">
              <m.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black tracking-tighter text-white mb-1 text-white">{m.value}</div>
            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.25em] mb-1">{m.label}</div>
            <div className="text-xs text-zinc-400 font-medium">{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

  const load = async () => {
    try {
      const data = await api.get("/admin/settings");
      setSettings(data.settings ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    await api.patch(`/admin/settings/${key}`, { value: newValue });
    setEditingKey(null);
    load();
    toast.success("Setting updated");
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tighter text-white text-white mb-2">Settings</h2>
        <p className="text-zinc-400 text-sm font-medium">Platform configuration.</p>
      </div>
      
      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-white/[0.04] backdrop-blur-xl rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="max-w-xl space-y-4">
          {settings.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-5 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40">
              <div className="flex-1 mr-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">{s.key.replace(/_/g, " ")}</div>
                {editingKey === s.key ? (
                  <input
                    type="text"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    autoFocus
                    className="w-full bg-white/[0.02] backdrop-blur-lg border border-white/10 rounded-lg px-2 py-1 font-bold text-sm text-white"
                  />
                ) : (
                  <div className="font-bold text-sm text-white">{s.value}</div>
                )}
                <div className="text-[9px] text-zinc-300 font-medium mt-1">{s.description}</div>
              </div>
              <div className="flex gap-2">
                {editingKey === s.key ? (
                  <>
                    <button onClick={() => setEditingKey(null)} className="px-3 py-1.5 rounded-xl bg-white/[0.04] backdrop-blur-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-700/80 text-white">Cancel</button>
                    <button onClick={() => save(s.key)} className="px-3 py-1.5 rounded-xl bg-swish-green text-black text-[9px] font-black uppercase tracking-widest hover:bg-[#E55A2A] shadow-[0_0_15px_rgba(255,107,53,0.3)]">Save</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingKey(s.key); setNewValue(s.value); }}
                    className="px-4 py-2 rounded-xl bg-white/[0.04] backdrop-blur-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700/80 transition-all text-white"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {/* Static info */}
          <div className="flex items-center justify-between p-5 bg-white/[0.02] backdrop-blur-lg/50 border border-white/10 rounded-2xl border-dashed">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-0.5">Backend Node</div>
              <div className="font-bold text-sm text-zinc-400">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1"}</div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-swish-green/10 text-swish-green text-[8px] font-black uppercase tracking-widest">Connected</span>
          </div>
        </div>
      )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-[32px] animate-pulse" />
          ))}
        </div>
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
                    <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-inner">
                      <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400">
                        {displayName[0]}
                      </span>
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
  { name: "Overview", icon: LayoutDashboard, component: OverviewTab },
  { name: "Orders", icon: ShoppingBag, component: OrdersTab },
  { name: "Scheduled", icon: Calendar, component: ScheduledTab },
  { name: "Menu", icon: Utensils, component: MenuTab },
  { name: "Inventory", icon: Box, component: InventoryTab },
  { name: "Fleet", icon: Bike, component: FleetTab },
  { name: "Applications", icon: Info, component: RiderApplicationsTab },
  { name: "Customers", icon: Users, component: CustomersTab },
  { name: "Support", icon: LifeBuoy, component: SupportTab },
  { name: "Finance", icon: Wallet, component: PayoutsTab },
  { name: "Analytics", icon: BarChart3, component: AnalyticsTab },
  { name: "Broadcast", icon: Send, component: BroadcastTab },
  { name: "Systems", icon: Cpu, component: SystemsTab },
  { name: "Marketing", icon: Zap, component: MarketingTab },
  { name: "Zones", icon: MapPin, component: ZonesTab },
  { name: "Kitchens", icon: Store, component: KitchensTab },
  { name: "Settings", icon: Settings, component: SettingsTab },
];

export default function AdminPage() {
  const { user, loading, logout } = useAuth()!;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Overview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.push("/login");
      return;
    } 
    
    if (user.role !== "super_admin") {
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

    return () => {
      socket.off("new_order");
      socket.off("order_status_update");
      socket.off("new_ticket");
      socket.disconnect();
    };
  }, [user, router]);

  const ActiveComponent = TABS.find(t => t.name === activeTab)?.component ?? OverviewTab;
  
  // Pass refreshKey to trigger re-fetches in tabs
  const componentKey = `${activeTab}-${refreshKey}`;

  return (
    <div className="min-h-screen bg-[#07070e] flex font-sans selection:bg-brand-primary/30 relative">
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

        <div className="flex-1 px-3 overflow-y-auto pb-4 space-y-6">
          {[
            { section: "Main", items: ["Overview", "Analytics", "Orders", "Scheduled", "Fleet", "Customers", "Support"] },
            { section: "Operations", items: ["Menu", "Inventory", "Zones", "Kitchens", "Finance", "Applications"] },
            { section: "System", items: ["Broadcast", "Marketing", "Systems", "Settings"] },
          ].map(group => (
            <div key={group.section}>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">{group.section}</div>
              <div className="space-y-0.5">
                {group.items.map(name => {
                  const tab = TABS.find(t => t.name === name);
                  if (!tab) return null;
                  const isActive = activeTab === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setActiveTab(name)}
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
            </div>
          ))}

          <div className="pt-4 border-t border-white/[0.05] px-3">
            <button className="w-full flex items-center justify-between py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
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
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-16 px-8 border-b border-white/[0.05] flex items-center justify-between bg-[#07070e]/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center w-full max-w-md relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3" />
            <input 
              type="text" 
              placeholder="Global search..." 
              className="w-full bg-[#11111a] border border-white/[0.05] rounded-lg pl-10 pr-12 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
            />
            <div className="absolute right-3 flex gap-1">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white/[0.05] rounded font-mono text-zinc-500 border border-white/[0.05]">⌘</kbd>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white/[0.05] rounded font-mono text-zinc-500 border border-white/[0.05]">K</kbd>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#07070e]" />
            </button>
            <div className="w-px h-6 bg-white/[0.1]" />
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs">
                {user?.name?.[0] ?? "A"}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </div>
          </div>
        </header>

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
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
