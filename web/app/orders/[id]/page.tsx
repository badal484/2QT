"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Bike, ShoppingBag, ChefHat, CheckCircle2,
  Phone, Download, Package, Lock, Star, Loader2, XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { socket } from "../../lib/socket";
import { api } from "../../lib/api";
import { useAuth } from "../../providers";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const LiveTrackingMap = dynamic(() => import("../../../components/LiveTrackingMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-100 animate-pulse" />,
});

interface OrderItem {
  menu_item_name: string;
  quantity: number;
  price_paise: number;
}

interface Order {
  id: string;
  display_id: string;
  status: "confirmed" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";
  customer_lat?: number;
  customer_lng?: number;
  kitchen_lat?: number;
  kitchen_lng?: number;
  rider_lat?: number;
  rider_lng?: number;
  rider_name?: string;
  rider_phone?: string;
  delivery_address_text?: string;
  delivery_address_label?: string;
  items: OrderItem[];
  subtotal_paise: number;
  delivery_fee_paise: number;
  discount_paise: number;
  loyalty_discount_paise: number;
  wallet_deduction_paise: number;
  surge_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  total_amount_paise: number;
  delivery_otp?: string;
}

const STEPS = [
  { id: "confirmed",        label: "Confirmed",  icon: ShoppingBag  },
  { id: "preparing",        label: "Preparing",  icon: ChefHat      },
  { id: "ready_for_pickup", label: "Pickup",     icon: Package      },
  { id: "out_for_delivery", label: "On the Way", icon: Bike         },
  { id: "delivered",        label: "Delivered",  icon: CheckCircle2 },
];

type HeroEntry = { icon: React.FC<{ className?: string }>; iconClass: string; bg: string; heading: string; sub: string };
const STATUS_HERO: Record<string, HeroEntry> = {
  confirmed:        { icon: ShoppingBag,  iconClass: "text-blue-500",   bg: "from-blue-50 to-indigo-100",   heading: "Order Confirmed!",  sub: "We have received your order"   },
  preparing:        { icon: ChefHat,      iconClass: "text-amber-500",  bg: "from-amber-50 to-orange-100",  heading: "Being Prepared",    sub: "Chef is cooking your meal"     },
  ready_for_pickup: { icon: Package,      iconClass: "text-purple-500", bg: "from-purple-50 to-violet-100", heading: "Ready for Pickup",  sub: "Looking for a rider near you"  },
  delivered:        { icon: CheckCircle2, iconClass: "text-green-500",  bg: "from-green-50 to-emerald-100", heading: "Delivered!",        sub: "Enjoy your meal"               },
  cancelled:        { icon: XCircle,      iconClass: "text-red-500",    bg: "from-red-50 to-rose-100",      heading: "Order Cancelled",   sub: "Refund will go to your wallet" },
};

function stepIndex(status: Order["status"]) {
  const map: Record<string, number> = {
    confirmed: 0, preparing: 1, ready_for_pickup: 2, out_for_delivery: 3, delivered: 4,
  };
  return map[status] ?? -1;
}

function HorizontalStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < current, active = i === current;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done ? "bg-brand-primary text-white" :
                active ? "bg-zinc-900 text-white ring-4 ring-zinc-900/10" :
                "bg-zinc-100 text-zinc-300"
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight whitespace-nowrap ${
                i > current ? "text-zinc-300" : active ? "text-zinc-900" : "text-brand-primary"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-1 mb-4" style={{ background: done ? 'var(--brand-primary,#FF5722)' : '#e4e4e7' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth()!;

  const [order, setOrder]                     = useState<Order | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [liveRider, setLiveRider]             = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta]                         = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [foodRating, setFoodRating]           = useState(0);
  const [deliveryRating, setDeliveryRating]   = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading]   = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace(`/login?redirect=/orders/${id}`);
  }, [authLoading, user, id, router]);

  // Data + socket
  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(d => { if (d.order) setOrder(d.order); })
      .finally(() => setLoading(false));

    const pollInterval = setInterval(async () => {
      try {
        const d = await api.get(`/orders/${id}`);
        if (d.order) {
          setOrder(prev => prev ? { ...d.order, items: prev.items } : d.order);
          if (d.order.rider_lat && d.order.rider_lng)
            setLiveRider({ lat: Number(d.order.rider_lat), lng: Number(d.order.rider_lng) });
        }
      } catch { /* silent */ }
    }, 15_000);

    const joinRoom = () => socket.emit("join_order", id);

    const onConnect    = () => { setSocketConnected(true);  joinRoom(); };
    const onDisconnect = () => { setSocketConnected(false); };
    const onStatus = ({ orderId, status }: { orderId: string; status: Order["status"] }) => {
      if (orderId === id) setOrder(prev => prev ? { ...prev, status } : prev);
    };
    const onRiderLoc = (loc: { lat: number | string; lng: number | string }) => {
      setLiveRider({ lat: Number(loc.lat), lng: Number(loc.lng) });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("order_status_update", onStatus);
    socket.on("rider_location", onRiderLoc);
    socket.connect();
    if (socket.connected) { setSocketConnected(true); joinRoom(); }

    return () => {
      clearInterval(pollInterval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("order_status_update", onStatus);
      socket.off("rider_location", onRiderLoc);
      socket.disconnect();
    };
  }, [id]);

  const handleEtaChange = useCallback((e: string | null) => setEta(e), []);

  const downloadInvoice = useCallback(async () => {
    setInvoiceLoading(true);
    try {
      const data = await api.get(`/orders/${id}/invoice`);
      if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank");
    } catch { toast.error("Could not generate invoice"); }
    finally { setInvoiceLoading(false); }
  }, [id]);

  // Auto-nudge when order transitions to delivered
  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current && prevStatusRef.current !== "delivered" && order.status === "delivered") {
      toast.success("Order delivered! Your invoice is ready.", {
        action: { label: "Download", onClick: downloadInvoice },
        duration: 8000,
      });
    }
    prevStatusRef.current = order.status;
  }, [order?.status, downloadInvoice]);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-brand-primary" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
      <ShoppingBag className="w-12 h-12 text-zinc-300 mb-4" />
      <h2 className="text-lg font-bold mb-2">Order not found</h2>
      <Link href="/menu" className="text-sm text-brand-primary font-semibold">Back to Menu</Link>
    </div>
  );

  const current = stepIndex(order.status);
  const isLive  = order.status === "out_for_delivery";
  const hero    = STATUS_HERO[order.status];

  return (
    <div className="min-h-screen bg-white">

      {/* ── Map / hero area ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: isLive ? "65vh" : "52vh", minHeight: 260 }}
      >
        {/* Floating nav */}
        <div className="absolute top-0 inset-x-0 z-50 px-4 pt-safe-top pt-4 flex items-center justify-between">
          <Link href="/menu"
            className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-zinc-800" />
          </Link>

          <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm flex items-center gap-2">
            {isLive && (
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-400'}`} />
            )}
            <p className="text-xs font-bold text-zinc-700">#{order.display_id}</p>
          </div>

          {["delivered", "cancelled"].includes(order.status) ? (
            <button
              onClick={downloadInvoice}
              disabled={invoiceLoading}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center disabled:opacity-50"
              title="Download Invoice"
            >
              {invoiceLoading
                ? <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                : <Download className="w-4 h-4 text-zinc-700" />}
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}
        </div>

        {/* Map or status illustration */}
        <AnimatePresence mode="wait">
          {isLive ? (
            <motion.div key="map" className="w-full h-full"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LiveTrackingMap
                kitchenLat={order.kitchen_lat   ? Number(order.kitchen_lat)   : undefined}
                kitchenLng={order.kitchen_lng   ? Number(order.kitchen_lng)   : undefined}
                customerLat={order.customer_lat ? Number(order.customer_lat)  : undefined}
                customerLng={order.customer_lng ? Number(order.customer_lng)  : undefined}
                initialRiderLat={order.rider_lat ? Number(order.rider_lat)    : undefined}
                initialRiderLng={order.rider_lng ? Number(order.rider_lng)    : undefined}
                liveRiderLat={liveRider?.lat}
                liveRiderLng={liveRider?.lng}
                onEtaChange={handleEtaChange}
              />
            </motion.div>
          ) : (
            <motion.div key="hero"
              className={`w-full h-full bg-gradient-to-b ${hero?.bg ?? "from-zinc-50 to-zinc-100"} flex items-center justify-center`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {hero && (
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
                  <hero.icon className={`w-20 h-20 ${hero.iconClass}`} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Live overlay card (Swiggy-style) ── */}
        {isLive && (
          <div className="absolute bottom-0 inset-x-0 z-[500] px-3 pb-3">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/15 px-4 py-3.5">

              {/* ETA row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-brand-primary animate-pulse' : 'bg-yellow-400'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
                      {socketConnected ? 'Live Tracking' : 'Connecting…'}
                    </span>
                  </div>
                  <p className="text-2xl font-black text-zinc-900 leading-tight">
                    {eta ?? 'On the way'}
                  </p>
                  <p className="text-xs text-zinc-400">Estimated delivery time</p>
                </div>
                <div className="text-right mt-0.5">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Order</p>
                  <p className="text-sm font-black text-zinc-700">#{order.display_id}</p>
                </div>
              </div>

              {/* Rider row */}
              {order.rider_name && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">
                      <Bike className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-semibold leading-none mb-0.5">Your Rider</p>
                      <p className="text-sm font-bold text-zinc-900">{order.rider_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.delivery_otp && (
                      <div className="bg-zinc-900 rounded-xl px-3 py-1.5 text-center">
                        <p className="text-[9px] text-zinc-400 uppercase tracking-wider leading-none mb-0.5">OTP</p>
                        <p className="text-sm font-black tracking-[0.2em] text-white">{order.delivery_otp}</p>
                      </div>
                    )}
                    {order.rider_phone && (
                      <a href={`tel:${order.rider_phone}`}
                        className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-md shadow-green-500/30 shrink-0">
                        <Phone className="w-4 h-4 text-white" />
                      </a>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Gradient fade when not live */}
        {!isLive && (
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>

      {/* ── Scrollable content below map ── */}
      <div className="bg-white relative z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>

        {/* Status heading — only when NOT live */}
        {!isLive && hero && (
          <div className="px-5 pt-3 pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-zinc-900 leading-tight">{hero.heading}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">{hero.sub}</p>
            </div>
          </div>
        )}

        {/* Progress stepper */}
        {order.status !== "cancelled" && (
          <div className="px-5 pb-4 border-b border-zinc-50">
            <HorizontalStepper current={current} />
          </div>
        )}

        {/* Rider card — only when NOT live (live shows it in overlay) */}
        {!isLive && order.rider_name && (
          <div className="mx-5 mt-4 bg-zinc-50 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
                <Bike className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Your Rider</p>
                <p className="font-black text-zinc-900 text-base mt-0.5">{order.rider_name}</p>
              </div>
            </div>
            {order.rider_phone && (
              <a href={`tel:${order.rider_phone}`}
                className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                <Phone className="w-4 h-4 text-white" />
              </a>
            )}
          </div>
        )}

        {/* OTP — only when NOT live (live shows it in overlay) */}
        {!isLive && order.status === "out_for_delivery" && (
          <div className="mx-5 mt-3">
            {order.delivery_otp ? (
              <div className="bg-zinc-900 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Delivery OTP</p>
                  <p className="text-3xl font-black tracking-[0.35em] text-white mt-1">{order.delivery_otp}</p>
                </div>
                <Lock className="w-6 h-6 text-zinc-500" />
              </div>
            ) : (
              <div className="bg-zinc-100 rounded-2xl px-5 py-4 flex items-center gap-3">
                <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                <p className="text-xs font-medium text-zinc-500">OTP will appear when rider arrives</p>
              </div>
            )}
          </div>
        )}

        {/* Delivery address */}
        <div className="mx-5 mt-3 flex items-start gap-3 bg-zinc-50 rounded-2xl p-4">
          <MapPin className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Delivery Address</p>
            <p className="text-sm font-medium text-zinc-900">{order.delivery_address_text ?? "Address not set"}</p>
            {order.delivery_address_label && (
              <span className="inline-block mt-1 text-[10px] font-semibold bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded-md uppercase tracking-wide">
                {order.delivery_address_label}
              </span>
            )}
          </div>
        </div>

        <div className="h-2 bg-zinc-50 mt-4" />

        {/* Order items */}
        <div className="px-5 pt-4">
          <h3 className="text-sm font-black text-zinc-900 mb-3">Items Ordered</h3>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-brand-primary w-6">{item.quantity}×</span>
                  <span className="text-sm font-medium text-zinc-800">{item.menu_item_name}</span>
                </div>
                <span className="text-sm font-semibold text-zinc-900">₹{(item.price_paise * item.quantity) / 100}</span>
              </div>
            ))}
          </div>

          {/* Bill */}
          <div className="pt-4 mt-4 border-t border-zinc-100 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Subtotal</span>
              <span className="text-sm font-medium text-zinc-800">₹{(order.subtotal_paise ?? 0) / 100}</span>
            </div>
            {(order.delivery_fee_paise > 0 || order.surge_paise > 0) && (
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Delivery & Surge</span>
                <span className="text-sm font-medium text-zinc-800">₹{((order.delivery_fee_paise ?? 0) + (order.surge_paise ?? 0)) / 100}</span>
              </div>
            )}
            {order.discount_paise > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Promo Discount</span>
                <span className="text-sm font-bold text-green-600">-₹{order.discount_paise / 100}</span>
              </div>
            )}
            {order.loyalty_discount_paise > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Loyalty Discount</span>
                <span className="text-sm font-bold text-green-600">-₹{order.loyalty_discount_paise / 100}</span>
              </div>
            )}
            {order.wallet_deduction_paise > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Wallet</span>
                <span className="text-sm font-bold text-brand-primary">-₹{order.wallet_deduction_paise / 100}</span>
              </div>
            )}
            {((order.cgst_paise ?? 0) + (order.sgst_paise ?? 0)) > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Taxes (GST)</span>
                <span className="text-sm font-medium text-zinc-800">₹{((order.cgst_paise ?? 0) + (order.sgst_paise ?? 0)) / 100}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-zinc-100">
              <span className="text-sm font-bold text-zinc-700">Total</span>
              <span className="text-base font-black text-zinc-900">₹{order.total_amount_paise / 100}</span>
            </div>
          </div>
        </div>

        <div className="h-2 bg-zinc-50 mt-4" />

        {/* Invoice ready card */}
        {order.status === "delivered" && (
          <div className="mx-5 mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-green-900">Invoice Ready</p>
              <p className="text-xs text-green-600 mt-0.5">Download your order receipt</p>
            </div>
            <button
              onClick={downloadInvoice}
              disabled={invoiceLoading}
              className="flex items-center gap-2 bg-green-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-green-500/20"
            >
              {invoiceLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
              Download
            </button>
          </div>
        )}

        {/* Feedback */}
        {order.status === "delivered" && (
          <div className="px-5 pt-4">
            {feedbackSubmitted ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="text-sm font-bold text-zinc-900">Thanks for your feedback!</p>
                <p className="text-xs text-zinc-400">+10 loyalty points earned</p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-black text-zinc-900 mb-4">How was your experience?</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Food Quality</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setFoodRating(n)} className="p-1">
                          <Star className={`w-7 h-7 transition-colors ${n <= foodRating ? "text-amber-400 fill-amber-400" : "text-zinc-200"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Delivery</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setDeliveryRating(n)} className="p-1">
                          <Star className={`w-7 h-7 transition-colors ${n <= deliveryRating ? "text-amber-400 fill-amber-400" : "text-zinc-200"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={e => setFeedbackComment(e.target.value)}
                    placeholder="Anything else? (optional)"
                    rows={2}
                    className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:ring-2 ring-brand-primary/20 resize-none text-zinc-900"
                  />
                  <button
                    disabled={feedbackLoading || foodRating === 0 || deliveryRating === 0}
                    onClick={async () => {
                      setFeedbackLoading(true);
                      try {
                        await api.post(`/orders/${order.id}/feedback`, { foodRating, deliveryRating, comment: feedbackComment });
                        setFeedbackSubmitted(true);
                        toast.success("Feedback submitted! +10 loyalty points");
                      } catch (e: any) {
                        toast.error(e.message || "Failed to submit feedback");
                      } finally { setFeedbackLoading(false); }
                    }}
                    className="w-full bg-brand-primary text-white text-sm font-bold py-3 rounded-2xl hover:bg-brand-dark transition-all disabled:opacity-50"
                  >
                    {feedbackLoading ? "Submitting…" : "Submit Feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Cancel */}
        {["confirmed", "preparing"].includes(order.status) && (
          <div className="mx-5 mt-4 bg-red-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-800">Cancel Order</p>
              <p className="text-xs text-red-400">Refund to wallet</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Cancel this order?")) return;
                try {
                  await api.post(`/orders/${order.id}/cancel`, {});
                  setOrder(prev => prev ? { ...prev, status: "cancelled" } : null);
                  toast.success("Order cancelled. Refund initiated.");
                } catch (e: any) { toast.error(e.message || "Failed to cancel"); }
              }}
              className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-600 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Help */}
        <div className="mx-5 mt-3 mb-8 bg-zinc-50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-900">Need help?</p>
            <p className="text-xs text-zinc-400">Support available 24/7</p>
          </div>
          <Link href="/profile?tab=support"
            className="bg-zinc-200 text-zinc-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-zinc-300 transition-all">
            Contact Us
          </Link>
        </div>

      </div>
    </div>
  );
}
