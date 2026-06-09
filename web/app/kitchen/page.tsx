"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../layout";
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
  const { user, logout, loading: authLoading } = useAuth()!;
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    } else if (user.role !== "chef" && user.role !== "super_admin") {
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
      // Add a mock order if empty for demo purposes
      if (!data.orders || data.orders.length === 0) {
        const savedMock = typeof window !== 'undefined' ? localStorage.getItem("mock_kitchen_orders") : null;
        if (savedMock) {
          setOrders(JSON.parse(savedMock));
        } else {
          const initialMock: Order[] = [
            {
              id: "mock-k1",
              display_id: "K-104",
              status: "confirmed",
              customer_name: "Arjun Reddy",
              items: [
                { name: "Premium Butter Naan", quantity: 3, price_paise: 13500, station: "Tandoor" },
                { name: "Paneer Butter Masala", quantity: 1, price_paise: 28000, station: "Curry" }
              ],
              created_at: new Date(Date.now() - 4 * 60000).toISOString() // 4 mins ago
            },
            {
              id: "mock-k2",
              display_id: "K-105",
              status: "preparing",
              customer_name: "Priya Sharma",
              items: [
                { name: "Mediterranean Quinoa Bowl", quantity: 1, price_paise: 25000, station: "Salad" }
              ],
              created_at: new Date(Date.now() - 12 * 60000).toISOString() // 12 mins ago
            }
          ];
          setOrders(initialMock);
          if (typeof window !== 'undefined') localStorage.setItem("mock_kitchen_orders", JSON.stringify(initialMock));
        }
      } else {
        setOrders(data.orders);
      }
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

    return () => {
      socket.off("new_order");
      socket.off("order_cancelled");
      socket.off("order_updated");
      socket.disconnect();
    };
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/kitchen/orders/${orderId}/status`, { status });
      setOrders(prev => {
        const next = prev.map(o => (o.id === orderId ? { ...o, status: status as Order["status"] } : o));
        if (typeof window !== 'undefined') localStorage.setItem("mock_kitchen_orders", JSON.stringify(next));
        return next;
      });
      toast.success(`Order updated`);
    } catch (err) {
      // Offline fallback
      setOrders(prev => {
        const next = prev.map(o => (o.id === orderId ? { ...o, status: status as Order["status"] } : o));
        if (typeof window !== 'undefined') localStorage.setItem("mock_kitchen_orders", JSON.stringify(next));
        return next;
      });
      toast.success(`Order updated (Offline Mode)`);
    } finally {
      setUpdatingId(null);
    }
  };

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

      {/* ── Main KDS Layout ── */}
      <main className="flex-1 p-6 overflow-hidden flex gap-6">
        
        {loading && orders.length === 0 ? (
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
        )}
      </main>
    </div>
  );
}
