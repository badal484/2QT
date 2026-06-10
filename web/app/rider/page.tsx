"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useAnimation, PanInfo } from "framer-motion";
import dynamic from "next/dynamic";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Package, CheckCircle2, ChevronRight,
  LogOut, Bike, Phone, Wallet, Clock, TrendingUp,
  ArrowRight, Zap, MapPin, Navigation,
} from "lucide-react";

const RiderLiveMap = dynamic(() => import("../../components/RiderLiveMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-zinc-950" />,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  display_id: string;
  status: "ready" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "confirmed" | "preparing";
  customer_name: string;
  customer_phone?: string;
  delivery_address_text: string;
  customer_lat?: number;
  customer_lng?: number;
  kitchen_lat?: number;
  kitchen_lng?: number;
  kitchen_name?: string;
  kitchen_address?: string;
  total_amount_paise: number;
  items?: { menu_item_name: string; quantity: number }[];
}

// ─── Countdown Ring ────────────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 22;

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const offset = CIRC * (1 - seconds / total);
  const color  = seconds > 9 ? '#22c55e' : seconds > 4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={CIRC} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
      </svg>
      <span className="text-xl font-black text-white z-10">{seconds}</span>
    </div>
  );
}

// ─── Delivery Step Bar ────────────────────────────────────────────────────────

function DeliverySteps({ status }: { status: string }) {
  const steps = [
    { label: 'Kitchen',   emoji: '🍳' },
    { label: 'Picked Up', emoji: '🛵' },
    { label: 'Delivered', emoji: '🏠' },
  ];
  const active = status === 'out_for_delivery' ? 1 : status === 'delivered' ? 2 : 0;
  return (
    <div className="flex items-center gap-1 px-5 py-3 border-t border-white/[0.06]">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1 flex-1 last:flex-none">
          <div className={`flex flex-col items-center transition-opacity ${i <= active ? 'opacity-100' : 'opacity-25'}`}>
            <span className="text-lg leading-none">{s.emoji}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 rounded-full mx-1 ${i < active ? 'bg-brand-primary' : 'bg-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Earnings Flash ───────────────────────────────────────────────────────────

function EarningsFlash({ amount, onDone }: { amount: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950/96 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }} className="text-center px-8">
        <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ delay: 0.3, duration: 0.6 }}
          className="text-7xl mb-6">🎉</motion.div>
        <p className="text-zinc-400 text-sm font-black uppercase tracking-widest mb-3">Delivery Complete</p>
        <p className="text-7xl font-black text-green-400">+₹{(amount / 100).toFixed(0)}</p>
        <p className="text-zinc-500 text-sm mt-3 font-semibold">Earned · Great work!</p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RiderPage() {
  const { user, logout, loading: authLoading } = useAuth()!;
  const router = useRouter();

  const [orders,          setOrders]          = useState<Order[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [isOnline,        setIsOnline]        = useState(false);
  const [incomingOrder,   setIncomingOrder]   = useState<Order | null>(null);
  const [countdown,       setCountdown]       = useState(15);
  const [verifyOtpFor,    setVerifyOtpFor]    = useState<string | null>(null);
  const [otpInput,        setOtpInput]        = useState("");
  const [activeTab,       setActiveTab]       = useState<"deliveries" | "earnings" | "history">("deliveries");
  const [riderLoc,        setRiderLoc]        = useState<{ lat: number; lng: number } | null>(null);
  const [todayEarnings,   setTodayEarnings]   = useState<any>(null);
  const [riderStats,      setRiderStats]      = useState<any>(null);
  const [orderHistory,    setOrderHistory]    = useState<any[]>([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [earningsFlash,   setEarningsFlash]   = useState<{ amount: number } | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
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

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const [poolRes, activeRes] = await Promise.all([
        api.get("/riders/orders/pool").catch(() => ({ orders: [] })),
        api.get("/riders/orders/active").catch(() => ({ orders: [] })),
      ]);
      const all: Order[] = [];
      if (activeRes.orders?.length > 0) all.push(...activeRes.orders);
      if (poolRes.orders?.length > 0) {
        const ids = new Set(activeRes.orders?.map((o: any) => o.id) || []);
        all.push(...poolRes.orders.filter((o: any) => !ids.has(o.id)));
      }
      setOrders(all);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, []);

  // ── Today's earnings (fetched on mount, refreshed on tab switch) ────────────
  const fetchEarnings = useCallback(async () => {
    try {
      const [today, stats] = await Promise.all([
        api.get("/riders/earnings/today").catch(() => ({ deliveriesCount: 0, totalPaise: 0 })),
        api.get("/riders/stats").catch(() => ({ totalDeliveries: 0, totalEarnings: 0, weekEarnings: 0, rating: 5.0 })),
      ]);
      setTodayEarnings(today);
      setRiderStats(stats);
    } catch {}
  }, []);

  useEffect(() => {
    if (user && (user.role === "rider" || user.role === "super_admin")) {
      fetchOrders();
      fetchEarnings();
    }
    const t = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(t);
  }, [user, fetchOrders, fetchEarnings]);

  // ── Tab-specific data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== "rider" && user.role !== "super_admin")) return;
    if (activeTab === "earnings") fetchEarnings();
    else if (activeTab === "history") {
      setHistoryLoading(true);
      api.get("/riders/orders/history")
        .then(d => setOrderHistory(d.orders ?? []))
        .catch(() => setOrderHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab, user, fetchEarnings]);

  // ── Socket: new order notifications ────────────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== "rider" && user.role !== "super_admin")) return;

    socket.connect();

    socket.on("new_available_mission", async ({ orderId }: { orderId: string; displayId: string }) => {
      try {
        const data = await api.get("/riders/orders/pool").catch(() => ({ orders: [] }));
        const found = data.orders?.find((o: any) => o.id === orderId);
        if (found) {
          setIncomingOrder(found);
          setCountdown(15);
        }
      } catch {}
      fetchOrders();
    });

    return () => {
      socket.off("new_available_mission");
      socket.disconnect();
    };
  }, [user, fetchOrders]);

  // ── Countdown timer for incoming order ─────────────────────────────────────
  useEffect(() => {
    if (!incomingOrder) return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIncomingOrder(null);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [incomingOrder]);

  // ── Live GPS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline || !user) return;
    if (!navigator.geolocation) return;

    const lastPos = { lat: 0, lng: 0 };
    const send = async (lat: number, lng: number) => {
      try { await api.post("/riders/location", { lat, lng }); } catch {}
    };

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        lastPos.lat = pos.coords.latitude;
        lastPos.lng = pos.coords.longitude;
        setRiderLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        send(pos.coords.latitude, pos.coords.longitude);
      },
      _err => {
        if (process.env.NODE_ENV === "development") {
          lastPos.lat = 12.9716; lastPos.lng = 77.5946;
          setRiderLoc({ lat: 12.9716, lng: 77.5946 });
          send(12.9716, 77.5946);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
    );

    const heartbeat = setInterval(() => {
      if (lastPos.lat !== 0) send(lastPos.lat, lastPos.lng);
    }, 15000);

    return () => { navigator.geolocation.clearWatch(watchId); clearInterval(heartbeat); };
  }, [isOnline, user]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const updateStatus = async (orderId: string, status: "out_for_delivery" | "delivered") => {
    try {
      if (status === "out_for_delivery") await api.post(`/riders/orders/${orderId}/claim`);
      await api.patch(`/riders/orders/${orderId}/status`, { status });
      if (status === "delivered") {
        const order = orders.find(o => o.id === orderId);
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setEarningsFlash({ amount: order?.total_amount_paise ?? 5000 });
        fetchEarnings();
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        toast.success("Order picked up! Head to customer.");
      }
    } catch (err: any) { toast.error(err.message || "Failed to update"); }
  };

  const handleVerifyOtp = async () => {
    if (!verifyOtpFor || otpInput.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    try {
      await api.post("/riders/verify-otp", { orderId: verifyOtpFor, otp: otpInput });
      const order = orders.find(o => o.id === verifyOtpFor);
      setOrders(prev => prev.filter(o => o.id !== verifyOtpFor));
      setVerifyOtpFor(null); setOtpInput("");
      setEarningsFlash({ amount: order?.total_amount_paise ?? 5000 });
      fetchEarnings();
    } catch (err: any) { toast.error(err.message || "Invalid OTP"); }
  };

  const toggleOnline = async () => {
    const next = !isOnline;
    try {
      await api.post(next ? "/riders/online" : "/riders/offline");
      setIsOnline(next);
      localStorage.setItem("rider_is_online", String(next));
      if (next) toast.success("You're online! Orders will come in.");
      else toast("You're now offline.");
    } catch (err: any) { toast.error(err.message || "Failed to update online status"); }
  };

  const acceptIncoming = () => {
    if (!incomingOrder) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setOrders(prev => [incomingOrder, ...prev]);
    setIncomingOrder(null);
    toast.success("Order accepted! Head to the kitchen.");
    fetchOrders();
  };

  const declineIncoming = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setIncomingOrder(null);
    setCountdown(15);
  };

  // ── Map destination ─────────────────────────────────────────────────────────
  const activeDelivery = orders.find(o => o.status === 'out_for_delivery');
  const activePickup   = orders.find(o => o.status === 'ready_for_pickup' || (o.status as any) === 'ready');
  const mapDestination = activeDelivery
    ? { lat: activeDelivery.customer_lat, lng: activeDelivery.customer_lng, type: 'customer' as const }
    : activePickup
    ? { lat: activePickup.kitchen_lat,    lng: activePickup.kitchen_lng,    type: 'kitchen' as const }
    : undefined;

  const mapLat = riderLoc?.lat ?? 12.9716;
  const mapLng = riderLoc?.lng ?? 77.5946;

  // ── Zone demand proxy ───────────────────────────────────────────────────────
  const demandLevel = orders.length >= 3 ? { label: '🔥 High Demand', color: 'text-orange-400' }
    : orders.length >= 1 ? { label: '🟡 Active Zone', color: 'text-amber-400' }
    : { label: '⚪ Quiet Now', color: 'text-zinc-400' };

  if (authLoading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">

      {/* ── Full-screen live map ─────────────────────────────────────────────── */}
      {activeTab === "deliveries" && (
        <div className="fixed inset-0 z-0">
          {isOnline ? (
            <RiderLiveMap
              riderLat={mapLat}
              riderLng={mapLng}
              destLat={mapDestination?.lat}
              destLng={mapDestination?.lng}
              destType={mapDestination?.type}
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-950" />
          )}
          {/* Gradient: dark at bottom so cards are readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none" style={{ zIndex: 2 }} />
        </div>
      )}
      {activeTab !== "deliveries" && <div className="fixed inset-0 z-0 bg-zinc-950" />}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 px-4 pt-safe-top">
        <div className="mt-3 flex items-center justify-between gap-2">

          {/* Name + status */}
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2.5 shadow-lg">
            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${isOnline ? 'bg-brand-primary' : 'bg-zinc-800'} transition-colors`}>
              <Bike className="w-[18px] h-[18px] text-white" />
              {isOnline && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-zinc-900 animate-pulse" />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-none mb-0.5">Rider</p>
              <p className="text-sm font-bold text-white leading-tight">{user?.name || "Rider"}</p>
            </div>
          </div>

          {/* Today earnings pill — always visible when online */}
          {isOnline && todayEarnings && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-green-500/15 border border-green-500/25 backdrop-blur-xl rounded-2xl px-3 py-2.5"
            >
              <Wallet className="w-3.5 h-3.5 text-green-400" />
              <div>
                <p className="text-xs font-black text-green-400 leading-none">
                  ₹{((todayEarnings.totalPaise ?? 0) / 100).toFixed(0)}
                </p>
                <p className="text-[9px] text-green-600 font-bold leading-none mt-0.5">
                  {todayEarnings.deliveriesCount ?? 0} orders
                </p>
              </div>
            </motion.div>
          )}

          {/* Online toggle + logout */}
          <div className="flex items-center gap-2">
            <button onClick={toggleOnline}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg border ${
                isOnline
                  ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                  : "bg-brand-primary text-white border-brand-primary/50 hover:bg-brand-primary/90"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-white/60"}`} />
              {isOnline ? "Online" : "Go Online"}
            </button>
            <button onClick={logout}
              className="w-10 h-10 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col min-h-screen pt-24 pb-28">

        {/* ─ Deliveries tab ─ */}
        {activeTab === "deliveries" && (
          <div className="flex-1 flex flex-col justify-end">

            {/* OFFLINE */}
            {!isOnline && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="w-24 h-24 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
                  <Bike className="w-10 h-10 text-zinc-700" />
                </motion.div>
                <h2 className="text-2xl font-black text-zinc-300 mb-2">You're offline</h2>
                <p className="text-zinc-500 text-sm mb-8">Tap "Go Online" to start receiving delivery orders</p>
                <button onClick={toggleOnline}
                  className="bg-brand-primary text-white font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-brand-primary/30 hover:bg-brand-primary/90 active:scale-95 transition-all flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Start Delivering
                </button>
              </div>
            )}

            {/* ONLINE + LOADING */}
            {isOnline && loading && (
              <div className="flex justify-center items-center flex-1">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* ONLINE + WAITING ─ Situational awareness card */}
            {isOnline && !loading && orders.length === 0 && (
              <div className="px-4 pb-2">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/60"
                >
                  {/* Zone + demand */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className={`text-xs font-black uppercase tracking-widest ${demandLevel.color}`}>
                        {demandLevel.label}
                      </span>
                    </div>
                    <Navigation className="w-4 h-4 text-zinc-600 animate-pulse" />
                  </div>

                  {/* Scanning animation */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex gap-1 items-end">
                      {[0, 150, 300].map(delay => (
                        <motion.span key={delay}
                          animate={{ scaleY: [0.4, 1.2, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: delay / 1000, ease: 'easeInOut' }}
                          className="w-1.5 rounded-full bg-brand-primary"
                          style={{ height: 18, transformOrigin: 'bottom' }}
                        />
                      ))}
                    </div>
                    <div>
                      <p className="text-base font-black text-white">Scanning for orders…</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Stay in your zone for faster assignments</p>
                    </div>
                  </div>

                  {/* Location row */}
                  {riderLoc && (
                    <div className="flex items-center gap-2 px-5 pb-4">
                      <MapPin className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                      <span className="text-[11px] font-mono text-zinc-500">
                        {riderLoc.lat.toFixed(4)}, {riderLoc.lng.toFixed(4)}
                      </span>
                      <span className="text-[10px] font-bold text-green-500 ml-auto">● GPS Live</span>
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {/* ONLINE + HAS ORDERS */}
            {isOnline && !loading && orders.length > 0 && (
              <div className="px-4 space-y-3 pb-2">
                <AnimatePresence mode="popLayout">
                  {orders.map((order, i) => (
                    <OrderCard key={order.id} order={order} index={i}
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

        {/* ─ Earnings tab ─ */}
        {activeTab === "earnings" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-2 space-y-4">
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
                  { label: "This Week",  val: `₹${((riderStats?.weekEarnings ?? 0) / 100).toFixed(0)}` },
                  { label: "Rating",     val: `${(riderStats?.rating ?? 5.0).toFixed(1)}★` },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5">{s.label}</p>
                    <p className="text-lg font-black text-white">{s.val}</p>
                  </div>
                ))}
              </div>
            </div>
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

        {/* ─ History tab ─ */}
        {activeTab === "history" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-2 space-y-3">
            <h2 className="text-2xl font-black text-white mb-4">Past Deliveries</h2>
            {historyLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}</div>
            ) : orderHistory.length === 0 ? (
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-10 text-center">
                <p className="text-zinc-400 font-bold">No deliveries yet.</p>
              </div>
            ) : orderHistory.map((h: any, i: number) => (
              <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
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

      {/* ── Incoming Order Bottom Sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {incomingOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-950/75 backdrop-blur-md">
            {/* Pulse ring on backdrop */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 border-4 border-brand-primary rounded-none pointer-events-none"
            />
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="bg-zinc-900 border border-white/10 rounded-t-[36px] px-5 pt-5 pb-10 shadow-2xl"
            >
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-5" />

              {/* Header row */}
              <div className="flex items-start gap-4 mb-5">
                <CountdownRing seconds={countdown} total={15} />
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-0.5">New Mission</p>
                  <h2 className="text-xl font-black text-white leading-tight">
                    #{incomingOrder.display_id}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {incomingOrder.items?.slice(0,2).map(i => `${i.quantity}× ${i.menu_item_name}`).join(', ')}
                    {(incomingOrder.items?.length ?? 0) > 2 && ` +${(incomingOrder.items?.length ?? 0) - 2} more`}
                  </p>
                </div>
              </div>

              {/* Route preview */}
              <div className="bg-zinc-800/60 border border-white/[0.06] rounded-2xl p-4 mb-5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">🍳</div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Pickup from</p>
                    <p className="text-sm font-bold text-white truncate">
                      {incomingOrder.kitchen_name || "Kitchen"}
                    </p>
                  </div>
                </div>
                <div className="ml-3.5 w-px h-3 bg-zinc-700" />
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center text-sm">🏠</div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Deliver to</p>
                    <p className="text-sm font-bold text-white truncate">
                      {incomingOrder.delivery_address_text || "Customer address"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Earnings preview */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="text-zinc-500 text-xs font-bold">Order value</span>
                <span className="text-white font-black text-base">
                  ₹{(incomingOrder.total_amount_paise / 100).toFixed(0)}
                </span>
              </div>

              {/* Accept / Decline */}
              <div className="flex gap-3">
                <button onClick={declineIncoming}
                  className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-300 font-black text-sm hover:bg-zinc-700 transition-colors border border-white/[0.06]">
                  Decline
                </button>
                <button onClick={acceptIncoming}
                  className="flex-[2] py-4 rounded-2xl bg-brand-primary text-white font-black text-sm hover:bg-orange-500 transition-all shadow-xl shadow-brand-primary/40 active:scale-95 flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" /> Accept Mission
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OTP Verify Sheet ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {verifyOtpFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/80 backdrop-blur-md">
            <motion.div
              initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="bg-zinc-900 border border-white/10 rounded-t-[36px] px-6 pt-6 pb-10 w-full max-w-sm mx-auto shadow-2xl">
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Customer OTP</h2>
                <p className="text-zinc-400 mt-2 text-sm">Ask customer for the 6-digit code</p>
              </div>
              <input type="text" inputMode="numeric" maxLength={6} value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-zinc-950 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black tracking-[0.3em] text-white focus:outline-none focus:border-brand-primary transition-colors mb-4"
                placeholder="• • • • • •" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => { setVerifyOtpFor(null); setOtpInput(""); }}
                  className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-300 font-black text-sm hover:bg-zinc-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleVerifyOtp}
                  className="flex-1 py-4 rounded-2xl bg-green-500 text-zinc-900 font-black text-sm hover:bg-green-400 transition-colors shadow-lg shadow-green-500/30">
                  Verify & Complete
                </button>
              </div>
              <button
                onClick={() => { toast.error("Dispute Logged: Customer Unreachable"); setVerifyOtpFor(null); setOtpInput(""); }}
                className="w-full mt-3 py-3 rounded-2xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors">
                Customer Unreachable?
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Earnings flash ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {earningsFlash && (
          <EarningsFlash amount={earningsFlash.amount} onDone={() => setEarningsFlash(null)} />
        )}
      </AnimatePresence>

      {/* ── Bottom Tab Bar ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-safe-bottom">
        <div className="mx-4 mb-4 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl px-2 py-2 flex items-center justify-around shadow-2xl">
          {[
            { key: "deliveries", icon: Package, label: "Orders" },
            { key: "earnings",   icon: Wallet,  label: "Earnings" },
            { key: "history",    icon: Clock,   label: "History" },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex flex-col items-center gap-1 px-6 py-2.5 rounded-2xl transition-all relative ${
                activeTab === key ? "bg-brand-primary/15 text-brand-primary" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
              {/* Badge for pending orders */}
              {key === "deliveries" && orders.length > 0 && activeTab !== "deliveries" && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-primary rounded-full text-[9px] font-black text-white flex items-center justify-center">
                  {orders.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onUpdate, isVerifying, index }: {
  order: Order;
  onUpdate: (id: string, s: "out_for_delivery" | "delivered") => void;
  isVerifying: boolean;
  index: number;
}) {
  const isPending = order.status === "confirmed" || order.status === "preparing";
  const isReady   = order.status === "ready_for_pickup" || (order.status as any) === "ready";
  const isOut     = order.status === "out_for_delivery";
  const nextStatus: "out_for_delivery" | "delivered" = isReady ? "out_for_delivery" : "delivered";

  const cfg = isPending
    ? { label: "Kitchen Preparing",  color: "text-amber-400",      bg: "bg-amber-400/10 border-amber-400/20" }
    : isReady
    ? { label: "Ready for Pickup",   color: "text-orange-400",     bg: "bg-orange-400/10 border-orange-400/20" }
    : { label: "Out for Delivery",   color: "text-brand-primary",  bg: "bg-brand-primary/10 border-brand-primary/20" };

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 30 }}
      className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[28px] overflow-hidden shadow-2xl shadow-black/50"
    >
      {/* Step progress */}
      <DeliverySteps status={order.status} />

      {/* Status + order ID */}
      <div className="px-5 pt-2 pb-0 flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${cfg.color} ${cfg.bg}`}>
          {cfg.label}
        </span>
        <span className="text-xs font-bold text-zinc-500">#{order.display_id}</span>
      </div>

      {/* Customer */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-lg text-white shrink-0">
          {order.customer_name?.charAt(0) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-base leading-tight">{order.customer_name}</p>
          <p className="text-xs text-zinc-500 font-semibold mt-0.5">Customer</p>
        </div>
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`}
            className="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-colors">
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Destination address */}
      <a
        href={
          order.customer_lat && order.customer_lng
            ? `https://www.google.com/maps/dir/?api=1&destination=${order.customer_lat},${order.customer_lng}`
            : `https://maps.google.com/?q=${encodeURIComponent(order.delivery_address_text || "")}`
        }
        target="_blank" rel="noopener noreferrer"
        className="mx-4 mb-3 flex items-center gap-3 bg-zinc-800/60 px-4 py-3 rounded-2xl hover:bg-zinc-800 transition-colors border border-white/5 group"
      >
        <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
        <span className="text-sm text-zinc-300 flex-1 truncate font-medium">
          {isOut
            ? (order.delivery_address_text || "Customer address")
            : (order.kitchen_address || order.kitchen_name || "Kitchen")}
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

function SwipeButton({ text, onComplete, isVerifying, color = "orange" }: {
  text: string; onComplete: () => void; isVerifying?: boolean; color?: "orange" | "green";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isVerifying === false) { setIsCompleted(false); controls.set({ x: 0 }); }
  }, [text, controls, isVerifying]);

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (isCompleted) return;
    const w = containerRef.current?.offsetWidth || 300;
    if (info.offset.x > w * 0.55) {
      setIsCompleted(true);
      await controls.start({ x: w - 60, transition: { type: "spring", stiffness: 300, damping: 20 } });
      onComplete();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
    }
  };

  const isOrange = color === "orange";
  const track = isOrange ? "bg-orange-500/10 border-orange-500/20" : "bg-green-500/10 border-green-500/20";
  const thumb = isCompleted ? (isOrange ? "bg-orange-500" : "bg-green-500") : (isOrange ? "bg-brand-primary" : "bg-green-500");
  const txt   = isOrange ? "text-orange-400" : "text-green-400";

  return (
    <div ref={containerRef} className={`relative h-14 rounded-2xl overflow-hidden flex items-center justify-center border ${track}`}>
      <span className={`text-sm font-black uppercase tracking-widest z-0 select-none pointer-events-none ${txt}`}>
        {isCompleted ? "✓ Done!" : text}
      </span>
      <motion.div drag={isCompleted ? false : "x"} dragConstraints={containerRef}
        dragElastic={0.03} dragMomentum={false} onDragEnd={handleDragEnd} animate={controls}
        className={`absolute left-1.5 top-1.5 bottom-1.5 aspect-square rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-colors shadow-lg ${thumb}`}>
        {isCompleted ? <CheckCircle2 className="w-5 h-5 text-white" /> : <ChevronRight className="w-5 h-5 text-white" />}
      </motion.div>
    </div>
  );
}
