"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ChefHat,
  Play,
  Check,
  LogOut,
  Bell,
  Timer,
  Package,
  AlertCircle,
  RefreshCw,
  MapPin,
  Bike,
  UserCheck,
  CircleDot,
  ChevronDown,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../providers";
import { socket } from "../lib/socket";

interface OrderItem {
  name: string;
  quantity: number;
  price_paise: number;
  station: string;
}

interface Order {
  id: string;
  display_id: string;
  status: "confirmed" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered";
  customer_name: string;
  items: OrderItem[];
  created_at: string;
}

interface LiveRider {
  id: string;
  name: string;
  phone: string;
  current_order_id: string | null;
  order_status: string | null;
  order_display_id: string | null;
  delivery_address: string | null;
  location: { lat: number; lng: number; updatedAt: string } | null;
}

interface UnassignedOrder {
  id: string;
  display_id: string;
  customer_name: string;
  delivery_address: string;
  created_at: string;
  items: { menu_item_name: string; quantity: number }[];
}

function minutesSince(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

const KDS_COLUMNS = [
  { id: "confirmed", title: "NEW ORDERS", theme: "green", glowColor: "rgba(34,197,94,0.5)", borderColor: "border-green-500/20", textColor: "text-green-400", bgAccent: "bg-gradient-to-br from-green-500/10 to-transparent", buttonColor: "bg-green-500 text-black hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]" },
  { id: "preparing", title: "PREPARING", theme: "amber", glowColor: "rgba(245,158,11,0.5)", borderColor: "border-amber-500/20", textColor: "text-amber-400", bgAccent: "bg-gradient-to-br from-amber-500/10 to-transparent", buttonColor: "bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]" },
  { id: "ready_for_pickup", title: "READY", theme: "zinc", glowColor: "rgba(161,161,170,0.3)", borderColor: "border-white/10", textColor: "text-white", bgAccent: "bg-gradient-to-br from-white/5 to-transparent", buttonColor: "bg-zinc-700 text-white hover:bg-zinc-600" },
];

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<"kds" | "dispatch">("kds");

  // Dispatch state
  const [riders, setRiders] = useState<LiveRider[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedOrder[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedRider, setSelectedRider] = useState<Record<string, string>>({});
  const dispatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { user, logout, loading: authLoading } = useAuth()!;
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    } else if (!["chef", "kitchen_manager", "super_admin"].includes(user.role)) {
      router.push("/menu");
    }
  }, [user, authLoading, router]);

  // Clock tick every minute for elapsed time
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.get("/kitchen/orders");
      setOrders(data.orders || []);
      setError(null);
    } catch (err: any) {
      setError("Could not reach kitchen server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    socket.connect();

    socket.on("new_order", () => {
      fetchOrders();
      const audio = new Audio("/notification.mp3");
      audio.play().catch(() => {});
    });

    socket.on("order_cancelled", ({ orderId }: { orderId: string }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    });

    socket.on("order_updated", () => {
      fetchOrders();
    });

    socket.on("order_status_update", () => {
      fetchOrders();
    });

    return () => {
      socket.off("new_order");
      socket.off("order_cancelled");
      socket.off("order_updated");
      socket.off("order_status_update");
      socket.disconnect();
    };
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/kitchen/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: status as Order["status"] } : o)));
      toast.success(`Order updated`);
    } catch (err) {
      toast.error(`Failed to update order`);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Dispatch data fetching ────────────────────────────────────────────────
  const fetchDispatch = useCallback(async () => {
    try {
      const [ridersData, unassignedData] = await Promise.all([
        api.get("/kitchen/riders/live"),
        api.get("/kitchen/orders/unassigned"),
      ]);
      setRiders(ridersData.riders || []);
      setUnassigned(unassignedData.orders || []);
    } catch {
      // silent — dispatch panel just won't refresh
    }
  }, []);

  useEffect(() => {
    if (view === "dispatch") {
      fetchDispatch();
      dispatchIntervalRef.current = setInterval(fetchDispatch, 5000);
    } else {
      if (dispatchIntervalRef.current) {
        clearInterval(dispatchIntervalRef.current);
        dispatchIntervalRef.current = null;
      }
    }
    return () => {
      if (dispatchIntervalRef.current) {
        clearInterval(dispatchIntervalRef.current);
        dispatchIntervalRef.current = null;
      }
    };
  }, [view, fetchDispatch]);

  // Also refresh dispatch on order_updated socket when in dispatch view
  useEffect(() => {
    const handler = () => { if (view === "dispatch") fetchDispatch(); };
    socket.on("order_updated", handler);
    return () => { socket.off("order_updated", handler); };
  }, [view, fetchDispatch]);

  const assignRider = async (orderId: string) => {
    const riderId = selectedRider[orderId];
    if (!riderId) { toast.error("Select a rider first"); return; }
    setAssigningId(orderId);
    try {
      await api.post(`/kitchen/orders/${orderId}/assign-rider`, { riderId });
      toast.success("Rider assigned!");
      setSelectedRider(prev => { const n = { ...prev }; delete n[orderId]; return n; });
      fetchDispatch();
    } catch (err: any) {
      toast.error(err.message || "Could not assign rider");
    } finally {
      setAssigningId(null);
    }
  };

  const idleRiders = riders.filter(r => !r.current_order_id);
  const busyRiders = riders.filter(r => !!r.current_order_id);

  const activeCount = orders.filter(o => ["confirmed", "preparing"].includes(o.status)).length;
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-brand-primary/20 overflow-x-hidden flex flex-col h-screen relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
      {/* ── Header ── */}
      <header className="border-b border-white/[0.05] bg-[#050505]/80 backdrop-blur-xl px-6 py-4 sticky top-0 z-50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-3xl font-bold tracking-tight">
              2QT<span className="text-brand-primary">.</span>{" "}
              <span className="text-zinc-400 font-medium">Kitchen</span>
            </Link>
            {/* ── View toggle (Dispatch only for manager/super_admin) ── */}
            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
              <button
                onClick={() => setView("kds")}
                className={`px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all ${view === "kds" ? "bg-green-500 text-black shadow-[0_0_16px_rgba(34,197,94,0.4)]" : "text-zinc-400 hover:text-white"}`}
              >
                KDS
              </button>
              {["kitchen_manager", "super_admin"].includes(user?.role ?? "") && (
              <button
                onClick={() => setView("dispatch")}
                className={`px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === "dispatch" ? "bg-orange-500 text-black shadow-[0_0_16px_rgba(249,115,22,0.4)]" : "text-zinc-400 hover:text-white"}`}
              >
                <Zap className="w-4 h-4" /> Dispatch
                {unassigned.length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center ml-1">
                    {unassigned.length}
                  </span>
                )}
              </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-8">
            {/* Clock */}
            <div className="text-3xl font-black tracking-tight">{currentTime}</div>

            {/* Active Tickets */}
            <div className="text-xl font-medium text-zinc-400">
              <span className="text-white font-bold">{activeCount}</span> Active Tickets
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg border-2 border-green-500 bg-green-500/10">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
              <span className="text-sm font-black uppercase tracking-widest text-green-500">Live</span>
            </div>

            <div className="flex gap-3 ml-4">
              <button onClick={fetchOrders} className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.1] transition-all">
                <RefreshCw className={`w-5 h-5 text-zinc-300 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => { logout(); router.push("/"); }} className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all group">
                <LogOut className="w-5 h-5 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 overflow-hidden flex gap-6">

        {/* ════════════════════════════════ DISPATCH VIEW ══════════════════════════ */}
        {view === "dispatch" && (
          <div className="flex-1 flex gap-6 overflow-hidden">

            {/* Left — Riders panel */}
            <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pb-6 custom-scrollbar">
              <div className="sticky top-0 bg-[#050505] pb-2 z-10">
                <h2 className="text-xl font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
                  <Bike className="w-5 h-5" /> Riders Online
                </h2>
                <p className="text-zinc-500 text-sm mt-1">{riders.length} online · {idleRiders.length} idle · {busyRiders.length} delivering</p>
              </div>

              {riders.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                  <Bike className="w-10 h-10 mb-3" />
                  <p className="font-bold">No riders online</p>
                </div>
              )}

              {/* Idle riders */}
              {idleRiders.map(rider => (
                <div key={rider.id} className="bg-[#0F1F18] border border-green-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] shrink-0" />
                    <span className="font-black text-white">{rider.name}</span>
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">IDLE</span>
                  </div>
                  <p className="text-zinc-500 text-xs">{rider.phone}</p>
                  {rider.location && (
                    <p className="text-zinc-600 text-xs mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {rider.location.lat.toFixed(4)}, {rider.location.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              ))}

              {/* Busy riders */}
              {busyRiders.map(rider => (
                <div key={rider.id} className="bg-[#1a1200] border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="font-black text-white">{rider.name}</span>
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">DELIVERING</span>
                  </div>
                  <p className="text-zinc-500 text-xs">{rider.phone}</p>
                  {rider.order_display_id && (
                    <p className="text-amber-400/70 text-xs mt-2 font-bold">
                      Order #{rider.order_display_id}
                    </p>
                  )}
                  {rider.delivery_address && (
                    <p className="text-zinc-600 text-xs mt-1 flex items-center gap-1 line-clamp-2">
                      <MapPin className="w-3 h-3 shrink-0" />{rider.delivery_address}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Right — Orders panel */}
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-6 custom-scrollbar">
              <div className="sticky top-0 bg-[#050505] pb-2 z-10">
                <h2 className="text-xl font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Needs Assignment
                  {unassigned.length > 0 && (
                    <span className="bg-red-500 text-white text-sm font-black rounded-full w-7 h-7 flex items-center justify-center">{unassigned.length}</span>
                  )}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">Ready at kitchen, no rider assigned</p>
              </div>

              {unassigned.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                  <UserCheck className="w-10 h-10 mb-3 text-green-700" />
                  <p className="font-bold text-green-700">All orders have riders</p>
                </div>
              )}

              <AnimatePresence>
                {unassigned.map(order => {
                  const waited = minutesSince(order.created_at);
                  const isUrgent = waited > 10;
                  const availableRiders = idleRiders;

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`rounded-2xl border p-5 ${isUrgent ? "bg-red-950/30 border-red-500/40" : "bg-[#111] border-white/10"}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-2xl font-black text-white">#{order.display_id}</div>
                          <div className="text-zinc-400 text-sm mt-1">{order.customer_name}</div>
                        </div>
                        <div className={`text-right ${isUrgent ? "text-red-400" : "text-zinc-400"}`}>
                          <div className="text-xl font-black">{waited}m</div>
                          {isUrgent && <div className="text-xs font-black uppercase text-red-400 animate-pulse">URGENT</div>}
                        </div>
                      </div>

                      <div className="flex items-start gap-1 text-zinc-500 text-xs mb-3">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{order.delivery_address}</span>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-4">
                        {order.items.map((item, i) => (
                          <span key={i} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-xs text-zinc-300 font-semibold">
                            {item.quantity}× {item.menu_item_name}
                          </span>
                        ))}
                      </div>

                      {availableRiders.length === 0 ? (
                        <div className="text-center text-zinc-600 text-sm py-2 border border-white/5 rounded-xl">
                          No idle riders available
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <select
                              value={selectedRider[order.id] || ""}
                              onChange={e => setSelectedRider(prev => ({ ...prev, [order.id]: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none cursor-pointer hover:bg-white/10 transition-all pr-8"
                            >
                              <option value="">Select rider…</option>
                              {availableRiders.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                          </div>
                          <button
                            onClick={() => assignRider(order.id)}
                            disabled={!selectedRider[order.id] || assigningId === order.id}
                            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl text-sm uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] flex items-center gap-2"
                          >
                            {assigningId === order.id
                              ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              : <><CircleDot className="w-4 h-4" /> Assign</>
                            }
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ════════════════════════════════ KDS VIEW ═══════════════════════════════ */}
        {view === "kds" && (loading && orders.length === 0 ? (
          <div className="w-full flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center">
            <ChefHat className="w-24 h-24 text-zinc-800 mb-6" />
            <h3 className="text-4xl font-black text-zinc-600">KITCHEN IS IDLE</h3>
          </div>
        ) : (
          KDS_COLUMNS.map(col => {
            const colOrders = orders.filter(o => o.status === col.id);
            return (
              <div key={col.id} className="flex-1 flex flex-col min-w-0 max-w-[33%]">
                {/* Column Header */}
                <div className="mb-4">
                  <h2 className={`text-3xl font-black tracking-tight ${col.textColor} mb-1`}>{col.title}</h2>
                  <div className="text-zinc-500 font-semibold">{colOrders.length} tickets</div>
                </div>

                {/* Tickets Container */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-20 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {colOrders.map(order => {
                      const elapsed = minutesSince(order.created_at);
                      // Urgent if un-prepped for > 15m or prep takes > 30m
                      const isUrgent = (order.status === "confirmed" && elapsed > 15) || (order.status === "preparing" && elapsed > 30);
                      const displayId = order.display_id.replace('K-', '').replace('ORD-', '');
                      
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -20 }}
                          key={order.id}
                          className={`bg-[#111]/90 backdrop-blur-md rounded-2xl border ${col.borderColor} flex flex-col overflow-hidden relative shadow-2xl group transition-all hover:border-white/20`}
                        >
                          {/* Glowing Top Accent */}
                          <div className={`absolute top-0 left-0 w-full h-1`} style={{ backgroundColor: col.textColor.replace('text-', '').split('-')[0], boxShadow: `0 0 15px ${col.glowColor}` }} />

                          {/* Ticket Header */}
                          <div className={`p-5 pb-4 border-b border-white/[0.05] flex justify-between items-start ${col.bgAccent}`}>
                            <div>
                              <div className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.glowColor.replace(/,\d+\.\d+\)/, ',1)') }}></span>
                                Ticket
                              </div>
                              <div className="text-4xl lg:text-5xl font-black leading-none tracking-tighter text-white drop-shadow-sm">K-{displayId}</div>
                            </div>
                            <div className="text-right flex flex-col items-end pt-1">
                              <div className={`text-3xl font-black tabular-nums leading-none tracking-tight ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white/90'}`}>
                                {formatTime(elapsed)}
                              </div>
                              {isUrgent && <div className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded-sm font-black uppercase tracking-widest mt-2 border border-red-500/30">URGENT</div>}
                            </div>
                          </div>

                          {/* Ticket Items */}
                          <div className="p-5 flex-1 flex flex-col gap-5">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-4">
                                <div className={`text-2xl font-black px-3 py-1 rounded-lg bg-white/5 border border-white/10 ${col.textColor}`}>
                                  {item.quantity}x
                                </div>
                                <div className="pt-1">
                                  <div className="text-2xl font-bold uppercase leading-tight tracking-tight text-white/90">{item.name}</div>
                                  {item.station && (
                                    <div className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                      <ChefHat className="w-3.5 h-3.5" /> {item.station}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Ticket Action Footer */}
                          {order.status === "confirmed" && (
                            <div className="p-4 pt-0">
                              <button
                                disabled={updatingId === order.id}
                                onClick={() => updateStatus(order.id, "preparing")}
                                className={`w-full py-4 rounded-xl text-xl font-black uppercase tracking-widest ${KDS_COLUMNS[0].buttonColor} transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3`}
                              >
                                {updatingId === order.id ? <div className="w-6 h-6 border-4 border-black border-t-transparent rounded-full animate-spin" /> : "START PREP"}
                              </button>
                            </div>
                          )}

                          {order.status === "preparing" && (
                            <div className="p-4 pt-0">
                              <button
                                disabled={updatingId === order.id}
                                onClick={() => updateStatus(order.id, "ready_for_pickup")}
                                className={`w-full py-4 rounded-xl text-xl font-black uppercase tracking-widest ${KDS_COLUMNS[1].buttonColor} transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3`}
                              >
                                {updatingId === order.id ? <div className="w-6 h-6 border-4 border-black border-t-transparent rounded-full animate-spin" /> : "MARK READY"}
                              </button>
                            </div>
                          )}
                          
                          {order.status === "ready_for_pickup" && (
                            <div className="m-4 mt-0 py-4 rounded-xl border border-white/10 bg-white/5 text-zinc-400 text-lg font-black uppercase tracking-widest text-center shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
                              AWAITING RIDER
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })
        ))}
      </main>
    </div>
  );
}
