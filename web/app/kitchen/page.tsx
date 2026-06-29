"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  LogOut,
  AlertCircle,
  RefreshCw,
  MapPin,
  Bike,
  UserCheck,
  CircleDot,
  ChevronDown,
  Zap,
  Settings,
  Power,
  Package,
  Loader2,
  Warehouse,
  PencilLine,
  Check,
  X,
  Timer,
  Bell,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../providers";
import { socket } from "../lib/socket";
import dynamic from "next/dynamic";

const DispatchMap = dynamic(() => import("../components/DispatchMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0F1F18] rounded-2xl flex items-center justify-center border border-green-500/20">
      <div className="text-green-500 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="font-bold tracking-widest uppercase text-xs">Loading Live Map...</span>
      </div>
    </div>
  ),
});

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
  kitchen_name?: string;
  items: OrderItem[];
  created_at: string;
}

interface LiveRider {
  id: string;
  name: string;
  phone: string;
  active_orders: { id: string; display_id: string; status: string; delivery_address: string }[] | null;
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

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price_paise: number;
  category: string;
  station: string;
  available: boolean;
  is_veg: boolean;
  is_egg: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_threshold: number;
  last_restocked_at: string | null;
}

function minutesSince(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const KDS_COLUMNS = [
  { id: "confirmed", title: "New Orders", borderColor: "border-white/10", indicatorColor: "bg-blue-500", textColor: "text-white", buttonColor: "bg-white text-black hover:bg-zinc-200 font-semibold" },
  { id: "preparing", title: "Preparing", borderColor: "border-white/10", indicatorColor: "bg-amber-500", textColor: "text-white", buttonColor: "bg-white text-black hover:bg-zinc-200 font-semibold" },
  { id: "ready_for_pickup", title: "Ready", borderColor: "border-white/10", indicatorColor: "bg-emerald-500", textColor: "text-white", buttonColor: "bg-zinc-800 text-white hover:bg-zinc-700 font-semibold" },
];

type KdsColId = "confirmed" | "preparing" | "ready_for_pickup";

function KdsColumn({ col, orders, updatingId, updateStatus }: {
  col: typeof KDS_COLUMNS[number];
  orders: Order[];
  updatingId: string | null;
  updateStatus: (id: string, status: string) => void;
}) {
  const colOrders = orders.filter(o => o.status === col.id);
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${col.indicatorColor}`} />
        <h2 className={`text-xl sm:text-lg font-semibold tracking-tight ${col.textColor}`}>{col.title}</h2>
        <span className="text-zinc-500 text-sm font-semibold ml-1">{colOrders.length}</span>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <AnimatePresence mode="popLayout">
          {colOrders.map(order => {
            const elapsed = minutesSince(order.created_at);
            const isUrgent = (order.status === "confirmed" && elapsed > 15) || (order.status === "preparing" && elapsed > 30);
            const displayId = order.display_id.replace("K-", "").replace("ORD-", "");

            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -16 }}
                key={order.id}
                className={`bg-[#111]/90 rounded-2xl border ${col.borderColor} flex flex-col overflow-hidden shadow-xl`}
              >
                <div className="p-4 sm:p-5 pb-3 border-b border-white/[0.05] flex justify-between items-start">
                  <div>
                    <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-[0.1em] mb-0.5">Ticket</div>
                    <div className={`text-2xl sm:text-3xl font-bold leading-none tracking-tight ${col.textColor}`}>K-{displayId}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl sm:text-2xl font-semibold tabular-nums leading-none ${isUrgent ? "text-red-500" : "text-white/80"}`}>
                      {formatTime(elapsed)}
                    </div>
                    {isUrgent && (
                      <div className="bg-red-500/10 text-red-500 text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider mt-1.5 border border-red-500/20">URGENT</div>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex flex-col gap-3 sm:gap-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`text-base sm:text-lg font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 ${col.textColor} shrink-0`}>
                        {item.quantity}x
                      </div>
                      <div className="pt-0.5">
                        <div className="text-sm sm:text-base font-medium capitalize leading-tight text-white/90">{item.name}</div>
                        {item.station && (
                          <div className="text-zinc-400 text-[11px] font-medium tracking-wide mt-1 flex items-center gap-1">
                            <ChefHat className="w-3 h-3" /> {item.station}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {order.status === "confirmed" && (
                  <div className="p-4 sm:p-5 pt-3">
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      disabled={updatingId === order.id}
                      className={`w-full py-2.5 sm:py-3 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${col.buttonColor}`}
                    >
                      {updatingId === order.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "START PREP"}
                    </button>
                  </div>
                )}

                {order.status === "preparing" && (
                  <div className="p-4 sm:p-5 pt-3">
                    <button
                      onClick={() => updateStatus(order.id, "ready_for_pickup")}
                      disabled={updatingId === order.id}
                      className={`w-full py-2.5 sm:py-3 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${col.buttonColor}`}
                    >
                      {updatingId === order.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "MARK READY"}
                    </button>
                  </div>
                )}

                {order.status === "ready_for_pickup" && (
                  <div className="mx-3 sm:mx-4 mb-3 sm:mb-4 py-3 rounded-xl border border-white/10 bg-white/5 text-zinc-400 text-sm sm:text-base font-black uppercase tracking-widest text-center">
                    AWAITING RIDER
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {colOrders.length === 0 && (
          <div className="py-8 text-center text-zinc-700">
            <div className="text-sm font-bold">No tickets</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [kitchenName, setKitchenName] = useState<string | null>(null);
  const [view, setView] = useState<"kds" | "dispatch" | "manage">("kds");
  const [mobileKdsCol, setMobileKdsCol] = useState<KdsColId>("confirmed");

  // Dispatch
  const [riders, setRiders] = useState<LiveRider[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedOrder[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedRider, setSelectedRider] = useState<Record<string, string>>({});
  const dispatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manage
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [kitchenPaused, setKitchenPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(30); // minutes; null = indefinite
  const [customMinutes, setCustomMinutes] = useState("");
  const [manageLoading, setManageLoading] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [pausingKitchen, setPausingKitchen] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState("");
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  // Live countdown tick
  const [, setCountdownTick] = useState(0);

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

  useEffect(() => {
    const id = setInterval(() => {}, 60000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.get("/kitchen/orders");
      setOrders(data.orders || []);
      if (data.kitchen_name) {
        setKitchenName(data.kitchen_name.toLowerCase());
      } else if (data.orders && data.orders.length > 0 && data.orders[0].kitchen_name) {
        setKitchenName(data.orders[0].kitchen_name.toLowerCase());
      }
      setError(null);
    } catch {
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
      new Audio("/notification.mp3").play().catch(() => {});
    });
    socket.on("order_cancelled", ({ orderId }: { orderId: string }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    });
    socket.on("order_updated", fetchOrders);
    socket.on("order_status_update", fetchOrders);
    return () => {
      socket.off("new_order");
      socket.off("order_cancelled");
      socket.off("order_updated", fetchOrders);
      socket.off("order_status_update", fetchOrders);
      socket.disconnect();
    };
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/kitchen/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: status as Order["status"] } : o)));
      toast.success("Order updated");
    } catch {
      toast.error("Failed to update order");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const fetchDispatch = useCallback(async () => {
    try {
      const [ridersData, unassignedData] = await Promise.all([
        api.get("/kitchen/riders/live"),
        api.get("/kitchen/orders/unassigned"),
      ]);
      setRiders(ridersData.riders || []);
      setUnassigned(unassignedData.orders || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (view === "dispatch") {
      fetchDispatch();
      dispatchIntervalRef.current = setInterval(fetchDispatch, 5000);
    } else {
      if (dispatchIntervalRef.current) { clearInterval(dispatchIntervalRef.current); dispatchIntervalRef.current = null; }
    }
    return () => { if (dispatchIntervalRef.current) { clearInterval(dispatchIntervalRef.current); dispatchIntervalRef.current = null; } };
  }, [view, fetchDispatch]);

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

  // ── Manage ────────────────────────────────────────────────────────────────
  const fetchManage = useCallback(async () => {
    setManageLoading(true);
    try {
      const [menuData, inventoryData] = await Promise.all([
        api.get("/kitchen/menu"),
        api.get("/kitchen/inventory"),
      ]);
      setMenuItems(menuData.menu || []);
      setInventory(inventoryData.inventory || []);
      setKitchenPaused(menuData.kitchenPaused || false);
      setPauseReason(menuData.pauseReason || "");
      setPauseUntil(menuData.pauseUntil || null);
    } catch {
      toast.error("Could not load kitchen data");
    } finally {
      setManageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "manage") fetchManage();
  }, [view, fetchManage]);

  // Live countdown tick every 5s while paused
  useEffect(() => {
    if (!kitchenPaused || !pauseUntil) return;
    const id = setInterval(() => setCountdownTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [kitchenPaused, pauseUntil]);

  const pauseKitchen = async () => {
    const durationMinutes = selectedDuration === -1
      ? parseInt(customMinutes, 10) || null
      : selectedDuration;
    setPausingKitchen(true);
    try {
      const res = await api.patch("/kitchen/status", {
        paused: true,
        reason: pauseReason || null,
        duration_minutes: durationMinutes,
      });
      setKitchenPaused(true);
      setPauseUntil(res.pauseUntil || null);
      toast.success(durationMinutes ? `Kitchen paused for ${durationMinutes} min` : "Kitchen paused indefinitely");
    } catch {
      toast.error("Failed to pause kitchen");
    } finally {
      setPausingKitchen(false);
    }
  };

  const openKitchen = async () => {
    setPausingKitchen(true);
    try {
      await api.patch("/kitchen/status", { paused: false });
      setKitchenPaused(false);
      setPauseUntil(null);
      setPauseReason("");
      toast.success("Kitchen is open again — customers notified");
    } catch {
      toast.error("Failed to open kitchen");
    } finally {
      setPausingKitchen(false);
    }
  };

  const toggleMenuItem = async (itemId: string, available: boolean) => {
    setTogglingItemId(itemId);
    setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, available } : m));
    try {
      await api.patch(`/kitchen/menu/${itemId}/availability`, { available });
    } catch {
      toast.error("Failed to update item");
      setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, available: !available } : m));
    } finally {
      setTogglingItemId(null);
    }
  };

  const saveStock = async (itemId: string) => {
    const val = parseFloat(stockDraft);
    if (isNaN(val) || val < 0) { toast.error("Enter a valid number"); return; }
    setSavingStockId(itemId);
    try {
      await api.patch(`/kitchen/inventory/${itemId}`, { current_stock: val });
      setInventory(prev => prev.map(i => i.id === itemId ? { ...i, current_stock: val } : i));
      setEditingStockId(null);
      toast.success("Stock updated");
    } catch {
      toast.error("Failed to update stock");
    } finally {
      setSavingStockId(null);
    }
  };

  const idleRiders = riders.filter(r => !r.active_orders || r.active_orders.length === 0);
  const busyRiders = riders.filter(r => r.active_orders && r.active_orders.length > 0);
  const activeCount = orders.filter(o => ["confirmed", "preparing"].includes(o.status)).length;
  const currentTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const lowStock = inventory.filter(i => i.current_stock < i.reorder_threshold);
  const menuByCategory = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden flex flex-col">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />

      {/* ── Header ── */}
      <header className="border-b border-white/[0.05] bg-[#050505]/90 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        {/* Top row */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="text-xl sm:text-2xl font-bold tracking-tight shrink-0">
            2QT<span className="text-brand-primary">.</span>{" "}
            <span className="text-zinc-400 font-medium hidden sm:inline">Kitchen</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Clock */}
            <div className="hidden sm:block text-xl font-black tracking-tight tabular-nums">{currentTime}</div>

            {/* Active tickets */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              <span className="text-white font-black text-sm">{activeCount}</span>
              <span className="text-zinc-500 text-xs font-medium hidden sm:inline">Active</span>
            </div>

            {/* Live pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-green-500 bg-green-500/10">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-green-500 hidden sm:inline">Live</span>
            </div>

            {/* Paused pill (outside manage tab) */}
            {kitchenPaused && view !== "manage" && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500 bg-red-500/10">
                <Power className="w-3 h-3 text-red-400" />
                <span className="text-xs font-black uppercase tracking-widest text-red-400">Paused</span>
              </div>
            )}

            <button onClick={fetchOrders} className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.1] transition-all">
              <RefreshCw className={`w-4 h-4 text-zinc-300 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => { logout(); router.push("/"); }} className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all">
              <LogOut className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setView("kds")}
            className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === "kds" ? "bg-green-500 text-black shadow-[0_0_16px_rgba(34,197,94,0.4)]" : "text-zinc-400 hover:text-white bg-white/5"}`}
          >
            KDS
          </button>

          {["kitchen_manager", "super_admin"].includes(user?.role ?? "") && (
            <button
              onClick={() => setView("dispatch")}
              className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${view === "dispatch" ? "bg-orange-500 text-black shadow-[0_0_16px_rgba(249,115,22,0.4)]" : "text-zinc-400 hover:text-white bg-white/5"}`}
            >
              <Zap className="w-3.5 h-3.5" /> Dispatch
              {unassigned.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">{unassigned.length}</span>
              )}
            </button>
          )}

          <button
            onClick={() => setView("manage")}
            className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${view === "manage" ? "bg-violet-500 text-white shadow-[0_0_16px_rgba(139,92,246,0.4)]" : "text-zinc-400 hover:text-white bg-white/5"}`}
          >
            <Settings className="w-3.5 h-3.5" /> Manage
            {kitchenPaused && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 p-4 sm:p-6">

        {/* ════════════════════════ DISPATCH VIEW ══════════════════════════════ */}
        {view === "dispatch" && (
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">

            {/* Riders panel */}
            <div className="lg:w-72 xl:w-80 shrink-0">
              <div className="mb-3">
                <h2 className="text-base font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
                  <Bike className="w-4 h-4" /> Riders Online
                </h2>
                <p className="text-zinc-500 text-xs mt-1">{riders.length} online · {idleRiders.length} idle · {busyRiders.length} delivering</p>
              </div>

              {riders.length === 0 && (
                <div className="flex flex-col items-center justify-center h-24 text-zinc-600">
                  <Bike className="w-7 h-7 mb-2" />
                  <p className="font-bold text-sm">No riders online</p>
                </div>
              )}

              {/* Horizontal scroll on mobile, vertical stack on desktop */}
              <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {idleRiders.map(rider => (
                  <div key={rider.id} className="bg-[#0F1F18] border border-green-500/20 rounded-2xl p-3 sm:p-4 shrink-0 w-52 lg:w-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                      <span className="font-black text-white text-sm truncate">{rider.name}</span>
                      <span className="ml-auto text-[9px] font-black bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full shrink-0">IDLE</span>
                    </div>
                    <p className="text-zinc-500 text-xs">{rider.phone}</p>
                  </div>
                ))}
                {busyRiders.map(rider => (
                  <div key={rider.id} className="bg-[#1a1200] border border-amber-500/20 rounded-2xl p-3 sm:p-4 shrink-0 w-52 lg:w-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <span className="font-black text-white text-sm truncate">{rider.name}</span>
                      <span className="ml-auto text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                        {rider.active_orders?.length}×
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">{rider.phone}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Map — desktop only */}
            <div className="hidden lg:block flex-1 min-h-[420px]">
              <DispatchMap riders={riders} />
            </div>

            {/* Unassigned orders */}
            <div className="lg:w-96 shrink-0 flex flex-col gap-3">
              <div>
                <h2 className="text-base font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Needs Assignment
                  {unassigned.length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">{unassigned.length}</span>
                  )}
                </h2>
                <p className="text-zinc-500 text-xs mt-1">Ready at kitchen, no rider assigned</p>
              </div>

              {unassigned.length === 0 && (
                <div className="flex flex-col items-center justify-center h-24 text-zinc-600">
                  <UserCheck className="w-7 h-7 mb-2 text-green-700" />
                  <p className="font-bold text-sm text-green-700">All orders have riders</p>
                </div>
              )}

              <AnimatePresence>
                {unassigned.map(order => {
                  const waited = minutesSince(order.created_at);
                  const isUrgent = waited > 10;
                  const availableRiders = riders.filter(r => !r.active_orders || r.active_orders.length < 3);
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`rounded-2xl border p-4 ${isUrgent ? "bg-red-950/30 border-red-500/40" : "bg-[#111] border-white/10"}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xl font-black text-white">#{order.display_id}</div>
                          <div className="text-zinc-400 text-xs mt-0.5">{order.customer_name}</div>
                        </div>
                        <div className={`text-right ${isUrgent ? "text-red-400" : "text-zinc-400"}`}>
                          <div className="text-lg font-black">{waited}m</div>
                          {isUrgent && <div className="text-[10px] font-black text-red-400 animate-pulse">URGENT</div>}
                        </div>
                      </div>
                      <div className="flex items-start gap-1 text-zinc-500 text-xs mb-3">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{order.delivery_address}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {order.items.map((item, i) => (
                          <span key={i} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-xs text-zinc-300 font-semibold">
                            {item.quantity}× {item.menu_item_name}
                          </span>
                        ))}
                      </div>
                      {availableRiders.length === 0 ? (
                        <div className="text-center text-zinc-600 text-xs py-2 border border-white/5 rounded-xl">No idle riders available</div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <select
                              value={selectedRider[order.id] || ""}
                              onChange={e => setSelectedRider(prev => ({ ...prev, [order.id]: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white appearance-none cursor-pointer hover:bg-white/10 transition-all pr-7"
                            >
                              <option value="">Select rider…</option>
                              {availableRiders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                          </div>
                          <button
                            onClick={() => assignRider(order.id)}
                            disabled={!selectedRider[order.id] || assigningId === order.id}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black font-black rounded-xl text-sm uppercase tracking-wider transition-all flex items-center gap-1.5"
                          >
                            {assigningId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CircleDot className="w-3.5 h-3.5" /> Assign</>}
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

        {/* ════════════════════════ MANAGE VIEW ════════════════════════════════ */}
        {view === "manage" && (
          manageLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Kitchen Status */}
              <div className={`rounded-2xl border p-5 sm:p-6 ${kitchenPaused ? "bg-red-950/20 border-red-500/30" : "bg-[#0a1f0a] border-green-500/20"}`}>
                {kitchenPaused ? (
                  /* ── PAUSED STATE ── */
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Power className="w-5 h-5 text-red-400 animate-pulse" />
                        <h2 className="text-base font-black uppercase tracking-wider">Kitchen Status</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/30">PAUSED</span>
                      </div>
                      {pauseReason && <p className="text-zinc-300 text-sm mb-1">"{pauseReason}"</p>}
                      {pauseUntil ? (() => {
                        const secsLeft = Math.max(0, Math.floor((new Date(pauseUntil).getTime() - Date.now()) / 1000));
                        const minsLeft = Math.floor(secsLeft / 60);
                        const secsRem = secsLeft % 60;
                        const autoResume = secsLeft > 0;
                        return autoResume ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Timer className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-amber-400 font-black text-lg tabular-nums">
                              {minsLeft}:{secsRem.toString().padStart(2, "0")}
                            </span>
                            <span className="text-zinc-500 text-sm">until auto-resume</span>
                          </div>
                        ) : (
                          <p className="text-zinc-500 text-sm mt-1">Paused indefinitely — open manually when ready.</p>
                        );
                      })() : (
                        <p className="text-zinc-500 text-sm mt-1">Paused indefinitely — open manually when ready.</p>
                      )}
                    </div>
                    <button
                      onClick={openKitchen}
                      disabled={pausingKitchen}
                      className="shrink-0 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm bg-green-500 text-black hover:bg-green-400 transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                      {pausingKitchen ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Power className="w-4 h-4" /> Open Now</>}
                    </button>
                  </div>
                ) : (
                  /* ── OPEN STATE — show duration picker ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Power className="w-5 h-5 text-green-400" />
                      <h2 className="text-base font-black uppercase tracking-wider">Kitchen Status</h2>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/30">OPEN</span>
                      <span className="text-zinc-500 text-sm ml-1">Accepting orders normally.</span>
                    </div>

                    {/* Duration picker */}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Pause duration</div>
                      <div className="flex flex-wrap gap-2">
                        {[15, 30, 60].map(d => (
                          <button
                            key={d}
                            onClick={() => setSelectedDuration(d)}
                            className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${selectedDuration === d ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"}`}
                          >
                            {d} min
                          </button>
                        ))}
                        <button
                          onClick={() => setSelectedDuration(-1)}
                          className={`px-4 py-2 rounded-xl text-sm font-black border transition-all flex items-center gap-1.5 ${selectedDuration === -1 ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"}`}
                        >
                          <Timer className="w-3.5 h-3.5" /> Custom
                        </button>
                        <button
                          onClick={() => setSelectedDuration(null)}
                          className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${selectedDuration === null ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"}`}
                        >
                          Indefinite
                        </button>
                      </div>

                      {selectedDuration === -1 && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={1} max={480}
                            placeholder="Minutes…"
                            value={customMinutes}
                            onChange={e => setCustomMinutes(e.target.value)}
                            className="w-28 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                          />
                          <span className="text-zinc-500 text-sm">minutes</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Reason (customers will see this)…"
                        value={pauseReason}
                        onChange={e => setPauseReason(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                      />
                      <button
                        onClick={pauseKitchen}
                        disabled={pausingKitchen || (selectedDuration === -1 && !parseInt(customMinutes, 10))}
                        className="shrink-0 px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-sm bg-red-500 text-white hover:bg-red-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        {pausingKitchen ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Power className="w-4 h-4" /> Pause Kitchen</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Low stock alert */}
              {lowStock.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black text-amber-400 text-xs uppercase tracking-widest mb-1">Low Stock Alert</div>
                    <p className="text-zinc-400 text-sm">{lowStock.map(i => i.name).join(", ")} {lowStock.length === 1 ? "is" : "are"} below reorder threshold.</p>
                  </div>
                </div>
              )}

              {/* Menu Availability */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-violet-400" />
                  <h2 className="text-base font-black uppercase tracking-wider">Menu Availability</h2>
                  <span className="text-zinc-500 text-sm ml-1">{menuItems.filter(m => m.available).length}/{menuItems.length} on</span>
                </div>

                {menuItems.length === 0 ? (
                  <div className="text-center text-zinc-600 py-12 border border-white/5 rounded-2xl">
                    <Package className="w-10 h-10 mx-auto mb-3" />
                    <p className="font-bold text-sm">No menu items</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(menuByCategory).map(([category, items]) => (
                      <div key={category}>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">{category}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                item.available ? "bg-white/[0.03] border-white/10" : "bg-red-950/10 border-red-500/15 opacity-60"
                              }`}
                            >
                              {/* Veg/Non-veg indicator */}
                              <span className={`w-3 h-3 rounded-full shrink-0 border-2 ${item.is_veg ? "border-green-500 bg-green-500/20" : item.is_egg ? "border-yellow-400 bg-yellow-400/20" : "border-red-500 bg-red-500/20"}`} />

                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-white truncate">{item.name}</div>
                                <div className="text-zinc-500 text-xs">{item.station || item.category} · ₹{(item.price_paise / 100).toFixed(0)}</div>
                              </div>

                              {/* Toggle switch */}
                              <button
                                onClick={() => toggleMenuItem(item.id, !item.available)}
                                disabled={togglingItemId === item.id}
                                className={`shrink-0 w-11 h-6 rounded-full border-2 transition-all relative disabled:opacity-50 ${
                                  item.available ? "bg-green-500 border-green-500" : "bg-zinc-700 border-zinc-600"
                                }`}
                              >
                                {togglingItemId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                                ) : (
                                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${item.available ? "left-5" : "left-0.5"}`} />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-violet-400" />
                    <h2 className="text-base font-black uppercase tracking-wider">Inventory</h2>
                  </div>
                  <button onClick={fetchManage} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-all">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {inventory.length === 0 ? (
                  <div className="text-center text-zinc-600 py-12 border border-white/5 rounded-2xl">
                    <Warehouse className="w-10 h-10 mx-auto mb-3" />
                    <p className="font-bold text-sm">No inventory tracked</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 overflow-hidden">
                    {/* Desktop table header */}
                    <div className="hidden sm:grid grid-cols-5 gap-4 px-4 py-2.5 bg-white/[0.03] border-b border-white/10 text-xs font-black uppercase tracking-widest text-zinc-500">
                      <span className="col-span-2">Item</span>
                      <span>Stock</span>
                      <span>Threshold</span>
                      <span>Last Restocked</span>
                    </div>

                    {inventory.map((item, idx) => {
                      const isLow = item.current_stock < item.reorder_threshold;
                      const isEditing = editingStockId === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`px-4 py-3 ${idx !== inventory.length - 1 ? "border-b border-white/5" : ""} ${isLow ? "bg-amber-950/10" : "hover:bg-white/[0.02]"} transition-all`}
                        >
                          {/* Mobile layout */}
                          <div className="sm:hidden">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-bold text-white text-sm">{item.name}</div>
                                <div className="text-zinc-500 text-xs">{item.unit}</div>
                              </div>
                              {isLow && <span className="text-[10px] font-black text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">LOW</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              {isEditing ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="number"
                                    value={stockDraft}
                                    onChange={e => setStockDraft(e.target.value)}
                                    className="flex-1 bg-white/10 border border-violet-500/40 rounded-lg px-3 py-1.5 text-sm text-white font-bold"
                                    autoFocus
                                  />
                                  <button onClick={() => saveStock(item.id)} disabled={savingStockId === item.id} className="px-3 py-1.5 bg-green-500 text-black rounded-lg font-black text-xs">
                                    {savingStockId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                                  </button>
                                  <button onClick={() => setEditingStockId(null)} className="px-2 py-1.5 bg-white/5 rounded-lg text-xs text-zinc-400">✕</button>
                                </div>
                              ) : (
                                <>
                                  <span className={`font-black text-sm ${isLow ? "text-amber-400" : "text-white"}`}>{item.current_stock} {item.unit}</span>
                                  <span className="text-zinc-600 text-xs">/ {item.reorder_threshold} min</span>
                                  <button
                                    onClick={() => { setEditingStockId(item.id); setStockDraft(String(item.current_stock)); }}
                                    className="ml-auto text-zinc-500 hover:text-violet-400 transition-all"
                                  >
                                    <PencilLine className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Desktop layout */}
                          <div className="hidden sm:grid grid-cols-5 gap-4 items-center">
                            <div className="col-span-2">
                              <div className="font-bold text-white text-sm">{item.name}</div>
                              <div className="text-zinc-500 text-xs">{item.unit}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    value={stockDraft}
                                    onChange={e => setStockDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") saveStock(item.id); if (e.key === "Escape") setEditingStockId(null); }}
                                    className="w-20 bg-white/10 border border-violet-500/40 rounded-lg px-2 py-1 text-sm text-white font-bold"
                                    autoFocus
                                  />
                                  <button onClick={() => saveStock(item.id)} disabled={savingStockId === item.id} className="text-green-400 hover:text-green-300 transition-all">
                                    {savingStockId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => setEditingStockId(null)} className="text-zinc-500 hover:text-white transition-all">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <span className={`font-black ${isLow ? "text-amber-400" : "text-white"}`}>{item.current_stock}</span>
                                  {isLow && <span className="text-[10px] font-black text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">LOW</span>}
                                  <button
                                    onClick={() => { setEditingStockId(item.id); setStockDraft(String(item.current_stock)); }}
                                    className="text-zinc-600 hover:text-violet-400 transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <PencilLine className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="text-zinc-400 text-sm">{item.reorder_threshold}</div>
                            <div className="text-zinc-500 text-xs">
                              {item.last_restocked_at
                                ? new Date(item.last_restocked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                                : "—"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ════════════════════════ KDS VIEW ═══════════════════════════════════ */}
        {view === "kds" && (
          loading && orders.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <AlertCircle className="w-14 h-14 text-red-500" />
              <h3 className="text-2xl font-black text-red-400">CANNOT REACH SERVER</h3>
              <p className="text-zinc-500 text-sm">{error}</p>
              <button onClick={fetchOrders} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm uppercase tracking-widest transition-all flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <ChefHat className="w-20 h-20 text-zinc-800 mb-5" />
              <h3 className="text-3xl sm:text-4xl font-black text-zinc-600">KITCHEN IS IDLE</h3>
            </div>
          ) : (
            <>
              {/* Mobile column selector */}
              <div className="flex sm:hidden gap-2 mb-4 overflow-x-auto scrollbar-none">
                {KDS_COLUMNS.map(col => {
                  const count = orders.filter(o => o.status === col.id).length;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setMobileKdsCol(col.id as KdsColId)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        mobileKdsCol === col.id ? `${col.indicatorColor} text-black` : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {col.title}
                      {count > 0 && (
                        <span className={`font-black text-[10px] px-1.5 py-0.5 rounded-full ${mobileKdsCol === col.id ? "bg-black/20" : "bg-white/10 text-white"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Desktop: 3 columns side-by-side */}
              <div className="hidden sm:flex gap-4 sm:gap-6 items-start">
                {KDS_COLUMNS.map(col => (
                  <KdsColumn key={col.id} col={col} orders={orders} updatingId={updatingId} updateStatus={updateStatus} />
                ))}
              </div>

              {/* Mobile: single selected column */}
              <div className="sm:hidden">
                {KDS_COLUMNS.filter(c => c.id === mobileKdsCol).map(col => (
                  <KdsColumn key={col.id} col={col} orders={orders} updatingId={updatingId} updateStatus={updateStatus} />
                ))}
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
