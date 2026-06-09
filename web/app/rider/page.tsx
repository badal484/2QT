"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useAnimation, PanInfo } from "framer-motion";
import dynamic from "next/dynamic";

const MapViewer = dynamic(() => import("../../components/MapViewer"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-900" />,
});
import { useAuth } from "../layout";
import { api } from "../lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MapPin, Navigation, Package, CheckCircle2, ChevronRight,
  LogOut, Bell, Bike, Phone, Wallet, Clock, TrendingUp,
  AlertCircle, ArrowRight, Zap
} from "lucide-react";

interface Order {
  id: string;
  display_id: string;
  status: "ready" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "confirmed" | "preparing";
  customer_name: string;
  customer_phone?: string;
  delivery_address_text: string;
  customer_lat?: number;
  customer_lng?: number;
  total_amount_paise: number;
}

export default function RiderPage() {
  const { user, logout, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const [verifyOtpFor, setVerifyOtpFor] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [activeTab, setActiveTab] = useState<"deliveries" | "earnings" | "history">("deliveries");
  const [riderLoc, setRiderLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [todayEarnings, setTodayEarnings] = useState<any>(null);
  const [riderStats, setRiderStats] = useState<any>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rider_is_online");
      if (stored === "true") setIsOnline(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "rider" && user.role !== "super_admin") router.replace("/menu");
  }, [user, authLoading, router]);

  const fetchOrders = useCallback(async () => {
    try {
      const [poolRes, activeRes] = await Promise.all([
        api.get("/riders/orders/pool").catch(() => ({ orders: [] })),
        api.get("/riders/orders/active").catch(() => ({ orders: [] })),
      ]);
      const allOrders: Order[] = [];
      if (activeRes.orders?.length > 0) allOrders.push(...activeRes.orders);
      if (poolRes.orders?.length > 0) {
        const activeIds = new Set(activeRes.orders?.map((o: any) => o.id) || []);
        allOrders.push(...poolRes.orders.filter((o: any) => !activeIds.has(o.id)));
      }
      setOrders(allOrders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === "rider" || user.role === "super_admin")) fetchOrders();
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [user, fetchOrders]);

  useEffect(() => {
    if (!user || (user.role !== "rider" && user.role !== "super_admin")) return;
    if (activeTab === "earnings") {
      Promise.all([
        api.get("/riders/earnings/today").catch(() => ({ deliveriesCount: 0, totalPaise: 0 })),
        api.get("/riders/stats").catch(() => ({ totalDeliveries: 0, totalEarnings: 0, weekEarnings: 0, rating: 5.0 })),
      ]).then(([today, stats]) => {
        setTodayEarnings(today);
        setRiderStats(stats);
      });
    } else if (activeTab === "history") {
      setHistoryLoading(true);
      api.get("/riders/orders/history")
        .then(d => setOrderHistory(d.orders ?? []))
        .catch(() => setOrderHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab, user]);

  // Live Location Broadcasting
  useEffect(() => {
    if (!isOnline || !user) return;
    if (!navigator.geolocation) { setLocError("Geolocation not supported"); return; }

    const sendLocation = async (lat: number, lng: number) => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("2qt_token") : null;
        if (!token) return;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/riders/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat, lng }),
        });
      } catch { /* silent */ }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocError(null);
        setRiderLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        sendLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocError(err.message);
        if (process.env.NODE_ENV === "development") {
          setRiderLoc({ lat: 12.9716, lng: 77.5946 });
          sendLocation(12.9716, 77.5946);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, user]);

  const updateStatus = async (orderId: string, status: "out_for_delivery" | "delivered") => {
    try {
      if (status === "out_for_delivery") await api.post(`/riders/orders/${orderId}/claim`);
      await api.patch(`/riders/orders/${orderId}/status`, { status });
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
        if (status === "delivered") return next.filter((o) => o.id !== orderId);
        return next;
      });
      if (status === "delivered") toast.success("🎉 Delivery complete! Great work!");
      else toast.success("Order picked up!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    }
  };

  const handleVerifyOtp = async () => {
    const orderId = verifyOtpFor;
    if (!orderId || otpInput.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    try {
      await api.post("/riders/verify-otp", { orderId, otp: otpInput });
      setVerifyOtpFor(null);
      setOtpInput("");
      // Backend already marks order delivered & records earnings; just remove from local state
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success("🎉 Delivery complete! Great work!");
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    }
  };

  const toggleOnline = async () => {
    const next = !isOnline;
    try {
      if (next) {
        await api.post("/riders/online");
      } else {
        await api.post("/riders/offline");
      }
      setIsOnline(next);
      if (typeof window !== "undefined") localStorage.setItem("rider_is_online", String(next));
      if (next) toast.success("You're online! Orders will come in.");
      else toast("You're now offline.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update online status");
    }
  };

  const mapLat = riderLoc?.lat || 12.9716;
  const mapLng = riderLoc?.lng || 77.5946;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
      {/* ── Full-screen map background (always visible when online) ── */}
      {isOnline && activeTab === "deliveries" && (
        <div className="fixed inset-0 z-0">
          <MapViewer lat={mapLat} lng={mapLng} hideControls />
          {/* Dramatic gradient — dark at bottom for cards, transparent at top */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent pointer-events-none" />
          {/* Subtle vignette on sides */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.5)_100%)] pointer-events-none" />
        </div>
      )}
      {!isOnline && activeTab === "deliveries" && (
        <div className="fixed inset-0 z-0 bg-zinc-950" />
      )}

      {/* ── Top Header ── */}
      <header className="fixed top-0 left-0 right-0 z-30 px-4 pt-safe-top">
        <div className="mt-3 flex items-center justify-between">
          {/* Left: Avatar + name + status */}
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2.5 shadow-lg">
            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${isOnline ? 'bg-brand-primary' : 'bg-zinc-800'} transition-colors`}>
              <Bike className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
              {isOnline && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-zinc-900" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 leading-none mb-0.5">Rider</p>
              <p className="text-sm font-bold text-white leading-tight">{user?.name || "Rider"}</p>
            </div>
          </div>

          {/* Right: Go Online toggle + logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleOnline}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg border ${
                isOnline
                  ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                  : "bg-brand-primary text-white border-brand-primary/50 hover:bg-brand-primary/90"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-white/60"}`} />
              {isOnline ? "Online" : "Go Online"}
            </button>
            <button
              onClick={logout}
              className="w-10 h-10 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="relative z-10 flex flex-col min-h-screen pt-24 pb-28">
        {/* ─ Deliveries Tab ─ */}
        {activeTab === "deliveries" && (
          <div className="flex-1 flex flex-col justify-end">
            {!isOnline ? (
              /* Offline state */
              <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="w-24 h-24 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-6 shadow-2xl"
                >
                  <Bike className="w-10 h-10 text-zinc-700" />
                </motion.div>
                <h2 className="text-2xl font-black text-zinc-300 mb-2">You're offline</h2>
                <p className="text-zinc-500 text-sm mb-8">Tap "Go Online" to start receiving delivery orders</p>
                <button
                  onClick={toggleOnline}
                  className="bg-brand-primary text-white font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-brand-primary/30 hover:bg-brand-primary/90 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Start Delivering
                </button>
              </div>
            ) : loading ? (
              <div className="flex justify-center items-center flex-1">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              /* Waiting for orders */
              <div className="flex flex-col items-center px-6 pb-8">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-full bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center mb-5"
                >
                  <Navigation className="w-8 h-8 text-brand-primary" />
                </motion.div>
                <h2 className="text-xl font-black text-white mb-1">Looking for orders…</h2>
                <p className="text-sm text-zinc-500 text-center">Stay in busy areas to get more requests</p>
              </div>
            ) : (
              /* Order cards — stacked at the bottom like Uber/DoorDash */
              <div className="px-4 space-y-3 pb-2">
                <AnimatePresence mode="popLayout">
                  {orders.map((order, i) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      index={i}
                      isVerifying={verifyOtpFor === order.id}
                      onUpdate={(id, status) => {
                        if (status === "delivered") setVerifyOtpFor(id);
                        else updateStatus(id, status);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ─ Earnings Tab ─ */}
        {activeTab === "earnings" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-2 space-y-4"
          >
            {/* Hero earnings card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-primary via-orange-500 to-amber-500 rounded-3xl p-6 shadow-2xl shadow-brand-primary/30">
              <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/10 rounded-full" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-black/10 rounded-full" />
              <p className="text-[11px] font-black uppercase tracking-widest text-white/70 mb-1 relative z-10">Today's Earnings</p>
              <p className="text-5xl font-black text-white mb-4 relative z-10">
                ₹{((todayEarnings?.totalPaise ?? 0) / 100).toFixed(2)}
              </p>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20 relative z-10">
                {[
                  { label: "Deliveries", val: String(todayEarnings?.deliveriesCount ?? 0) },
                  { label: "Total (week)", val: `₹${((riderStats?.weekEarnings ?? 0) / 100).toFixed(0)}` },
                  { label: "Rating", val: `${(riderStats?.rating ?? 5.0).toFixed(1)}★` },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5">{s.label}</p>
                    <p className="text-lg font-black text-white">{s.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Lifetime stats */}
            <div className="bg-zinc-900 border border-white/5 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-white">Lifetime Stats</h3>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Deliveries</p>
                  <p className="text-2xl font-black text-white">{riderStats?.totalDeliveries ?? 0}</p>
                </div>
                <div className="bg-zinc-800 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Earned</p>
                  <p className="text-2xl font-black text-green-400">₹{((riderStats?.totalEarnings ?? 0) / 100).toFixed(0)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─ History Tab ─ */}
        {activeTab === "history" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-2 space-y-3"
          >
            <h2 className="text-2xl font-black text-white mb-4">Past Deliveries</h2>
            {historyLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}
              </div>
            ) : orderHistory.length === 0 ? (
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-10 text-center">
                <p className="text-zinc-400 font-bold">No deliveries yet.</p>
                <p className="text-zinc-600 text-sm mt-1">Your completed orders will appear here.</p>
              </div>
            ) : orderHistory.map((h: any, i: number) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-zinc-400">#{h.display_id}</span>
                    <span className="text-[10px] text-zinc-600">·</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(h.delivered_at || h.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{h.delivery_address_text || "Unknown address"}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{h.customer_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-green-400">+₹{((h.total_amount_paise ?? 0) / 100).toFixed(0)}</p>
                  <p className="text-[10px] text-zinc-500 capitalize">{h.status}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* ── Incoming Order Modal ── */}
      <AnimatePresence>
        {incomingOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-950/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="bg-zinc-900 border border-white/10 rounded-t-[40px] px-6 pt-6 pb-10 shadow-2xl"
            >
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-primary/20 flex items-center justify-center">
                  <Package className="w-7 h-7 text-brand-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">New Order</p>
                  <h2 className="text-xl font-black text-white">Delivery Request</h2>
                  <p className="text-sm text-zinc-400 mt-0.5 truncate max-w-[220px]">{incomingOrder.delivery_address_text}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIncomingOrder(null)}
                  className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-300 font-black text-sm hover:bg-zinc-700 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => {
                    setOrders((prev) => [incomingOrder, ...prev]);
                    setIncomingOrder(null);
                    toast.success("Order accepted!");
                  }}
                  className="flex-1 py-4 rounded-2xl bg-brand-primary text-white font-black text-sm hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/30"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OTP Verify Modal ── */}
      <AnimatePresence>
        {verifyOtpFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="bg-zinc-900 border border-white/10 rounded-t-[40px] px-6 pt-6 pb-10 w-full max-w-sm mx-auto shadow-2xl"
            >
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Customer OTP</h2>
                <p className="text-zinc-400 mt-2 text-sm">Ask customer for the 6-digit code</p>
                {process.env.NODE_ENV === "development" && (
                  <p className="text-xs text-brand-primary mt-1">Dev hint: use 654321</p>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-zinc-950 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black tracking-[0.3em] text-white focus:outline-none focus:border-brand-primary transition-colors mb-4"
                placeholder="• • • • • •"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setVerifyOtpFor(null); setOtpInput(""); }}
                  className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-300 font-black text-sm hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyOtp}
                  className="flex-1 py-4 rounded-2xl bg-green-500 text-zinc-900 font-black text-sm hover:bg-green-400 transition-colors shadow-lg shadow-green-500/30"
                >
                  Verify & Complete
                </button>
              </div>
              <button
                onClick={() => { toast.error("Dispute Logged: Customer Unreachable"); setVerifyOtpFor(null); setOtpInput(""); }}
                className="w-full mt-3 py-3 rounded-2xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors"
              >
                Customer Unreachable?
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Tab Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-safe-bottom">
        <div className="mx-4 mb-4 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl px-2 py-2 flex items-center justify-around shadow-2xl">
          {[
            { key: "deliveries", icon: Package, label: "Orders" },
            { key: "earnings", icon: Wallet, label: "Earnings" },
            { key: "history", icon: Clock, label: "History" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex flex-col items-center gap-1 px-6 py-2.5 rounded-2xl transition-all ${
                activeTab === key
                  ? "bg-brand-primary/15 text-brand-primary"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────

function OrderCard({ order, onUpdate, isVerifying, index }: {
  order: Order;
  onUpdate: (id: string, s: "out_for_delivery" | "delivered") => void;
  isVerifying: boolean;
  index: number;
}) {
  const isPending = order.status === "confirmed" || order.status === "preparing";
  const isReady = order.status === "ready_for_pickup" || (order.status as any) === "ready";
  const isOut = order.status === "out_for_delivery";
  const nextStatus = isReady ? "out_for_delivery" : "delivered";

  const statusConfig = {
    pending: { label: "Kitchen Preparing", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    ready: { label: "Ready for Pickup", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
    out: { label: "Out for Delivery", color: "text-brand-primary", bg: "bg-brand-primary/10 border-brand-primary/20" },
  };
  const cfg = isPending ? statusConfig.pending : isReady ? statusConfig.ready : statusConfig.out;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 30 }}
      className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[28px] overflow-hidden shadow-2xl shadow-black/50"
    >
      {/* Status pill */}
      <div className="px-5 pt-4 pb-0 flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${cfg.color} ${cfg.bg}`}>
          {cfg.label}
        </span>
        <span className="text-xs font-bold text-zinc-500">#{order.display_id}</span>
      </div>

      {/* Customer info */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-lg text-white shrink-0">
          {order.customer_name?.charAt(0) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-base leading-tight">{order.customer_name}</p>
          <p className="text-xs text-zinc-500 font-semibold mt-0.5">Customer</p>
        </div>
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone}`}
            className="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Address */}
      <a
        href={
          order.customer_lat && order.customer_lng
            ? `https://www.google.com/maps/dir/?api=1&destination=${order.customer_lat},${order.customer_lng}`
            : `https://maps.google.com/?q=${encodeURIComponent(order.delivery_address_text || "")}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="mx-4 mb-3 flex items-center gap-3 bg-zinc-800/60 px-4 py-3 rounded-2xl hover:bg-zinc-800 transition-colors border border-white/5 group"
      >
        <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
        <span className="text-sm text-zinc-300 flex-1 truncate font-medium">
          {order.delivery_address_text || "Address not available"}
        </span>
        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </a>

      {/* Action */}
      <div className="px-4 pb-5">
        {isPending ? (
          <div className="w-full bg-zinc-800/50 border border-white/5 text-zinc-500 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            Waiting for Kitchen…
          </div>
        ) : (
          <SwipeButton
            text={isReady ? "Swipe to Pick Up" : "Swipe to Deliver"}
            color={isReady ? "orange" : "green"}
            onComplete={() => onUpdate(order.id, nextStatus)}
            isVerifying={isVerifying}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Swipe Button ─────────────────────────────────────────────────────────────

function SwipeButton({
  text, onComplete, isVerifying, color = "orange",
}: {
  text: string;
  onComplete: () => void;
  isVerifying?: boolean;
  color?: "orange" | "green";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isVerifying === false) {
      setIsCompleted(false);
      controls.set({ x: 0 });
    }
  }, [text, controls, isVerifying]);

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (isCompleted) return;
    const containerWidth = containerRef.current?.offsetWidth || 300;
    if (info.offset.x > containerWidth * 0.55) {
      setIsCompleted(true);
      await controls.start({ x: containerWidth - 60, transition: { type: "spring", stiffness: 300, damping: 20 } });
      onComplete();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
    }
  };

  const isOrange = color === "orange";
  const trackClass = isOrange ? "bg-orange-500/10 border-orange-500/20" : "bg-green-500/10 border-green-500/20";
  const thumbClass = isCompleted
    ? (isOrange ? "bg-orange-500" : "bg-green-500")
    : (isOrange ? "bg-brand-primary" : "bg-green-500");
  const textClass = isOrange ? "text-orange-400" : "text-green-400";

  return (
    <div
      ref={containerRef}
      className={`relative h-14 rounded-2xl overflow-hidden flex items-center justify-center border ${trackClass}`}
    >
      <span className={`text-sm font-black uppercase tracking-widest z-0 select-none pointer-events-none ${textClass}`}>
        {isCompleted ? "✓ Done!" : text}
      </span>
      <motion.div
        drag={isCompleted ? false : "x"}
        dragConstraints={containerRef}
        dragElastic={0.03}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={`absolute left-1.5 top-1.5 bottom-1.5 aspect-square rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-colors shadow-lg ${thumbClass}`}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-white" />
        ) : (
          <ChevronRight className="w-5 h-5 text-white" />
        )}
      </motion.div>
    </div>
  );
}
