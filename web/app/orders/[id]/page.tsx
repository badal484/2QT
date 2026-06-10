"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Bike, ShoppingBag, ChefHat, CheckCircle2, Clock, Phone, Download, Package, Lock, Zap, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { socket } from "../../lib/socket";
import { api } from "../../lib/api";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const LiveTrackingMap = dynamic(() => import("../../../components/LiveTrackingMap"), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-100 animate-pulse rounded-3xl" />
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
  { id: "confirmed", label: "Order Confirmed", icon: ShoppingBag, desc: "We've received your order" },
  { id: "preparing", label: "Preparing", icon: ChefHat, desc: "Kitchen is cooking your meal" },
  { id: "ready_for_pickup", label: "Ready for Pickup", icon: Package, desc: "Waiting for rider" },
  { id: "out_for_delivery", label: "On the Way", icon: Bike, desc: "Rider is heading to you" },
  { id: "delivered", label: "Delivered", icon: CheckCircle2, desc: "Enjoy your meal!" },
];

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Order Confirmed",
  preparing: "Being Prepared",
  ready_for_pickup: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-600",
  preparing: "bg-amber-50 text-amber-600",
  ready_for_pickup: "bg-purple-50 text-purple-600",
  out_for_delivery: "bg-brand-primary/10 text-brand-primary",
  delivered: "bg-zinc-100 text-zinc-500",
  cancelled: "bg-red-50 text-red-500",
};

function stepIndex(status: Order["status"]) {
  if (status === "confirmed") return 0;
  if (status === "preparing") return 1;
  if (status === "ready_for_pickup") return 2;
  if (status === "out_for_delivery") return 3;
  if (status === "delivered") return 4;
  return -1;
}

export default function OrderTrackingPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveRiderLocation, setLiveRiderLocation] = useState<{lat: number, lng: number} | null>(null);
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(d => { if (d.order) setOrder(d.order); })
      .finally(() => setLoading(false));

    // Fallback poll every 15s to refresh rider position from Redis in case socket misses events
    const pollInterval = setInterval(async () => {
      try {
        const d = await api.get(`/orders/${id}`);
        if (d.order) {
          setOrder(prev => {
            if (!prev) return d.order;
            return { ...d.order, items: prev.items }; // keep items from first load
          });
          if (d.order.rider_lat && d.order.rider_lng) {
            setLiveRiderLocation({ lat: Number(d.order.rider_lat), lng: Number(d.order.rider_lng) });
          }
        }
      } catch { /* silent */ }
    }, 15000);

    const joinRoom = () => socket.emit("join_order", id);

    socket.connect();
    // Re-join room on every (re)connect so we never miss events after Render cold start
    socket.on("connect", joinRoom);
    if (socket.connected) joinRoom();

    socket.on("order_status_update", ({ orderId, status }: { orderId: string; status: Order["status"] }) => {
      if (orderId === id) setOrder(prev => prev ? { ...prev, status } : null);
    });

    socket.on("rider_location", (location: { lat: number; lng: number }) => {
      setLiveRiderLocation(location);
    });

    return () => {
      clearInterval(pollInterval);
      socket.off("connect", joinRoom);
      socket.off("order_status_update");
      socket.off("rider_location");
      socket.disconnect();
    };
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
      <ShoppingBag className="w-12 h-12 text-zinc-300 mb-4" />
      <h2 className="text-lg font-bold mb-2">Order not found</h2>
      <Link href="/menu" className="text-sm text-brand-primary font-semibold hover:underline">Back to Menu</Link>
    </div>
  );

  const current = stepIndex(order.status);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Nav */}
      <nav className="nav-glass sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/menu" className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Menu
          </Link>
          <div className="text-center">
            <p className="text-xs text-zinc-400 font-medium">Order #{order.display_id}</p>
          </div>
          <button
            onClick={async () => {
              try {
                const data = await api.get(`/orders/${order.id}/invoice`);
                if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank");
              } catch {
                toast.error("Could not generate invoice");
              }
            }}
            className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-swish-green hover:text-white transition-all"
            title="Download Invoice"
          >
            <Download className="w-4 h-4" />
          </button>
          <a
            href={order.rider_phone && order.status === "out_for_delivery" ? `tel:${order.rider_phone}` : "tel:+918867000000"}
            title={order.rider_phone && order.status === "out_for_delivery" ? "Call Rider" : "Call Support"}
            className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition-all"
          >
            <Phone className="w-4 h-4" />
          </a>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status banner */}
        <div className="bg-white rounded-2xl border border-zinc-100 card-shadow p-5 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STATUS_COLORS[order.status] ?? "bg-zinc-100 text-zinc-500"}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-zinc-900">{STATUS_LABELS[order.status] ?? order.status}</p>
            {order.status !== "delivered" && order.status !== "cancelled" && (
              <p className="text-xs text-brand-primary font-bold mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3 animate-pulse" /> 15 Min Delivery</p>
            )}
          </div>
          <span className={`ml-auto badge text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
            Live
          </span>
        </div>

        {/* Progress tracker */}
        {order.status !== "cancelled" && (
          <div className="bg-white rounded-2xl border border-zinc-100 card-shadow p-6">
            <div className="space-y-0">
              {STEPS.map((step, i) => {
                const done = i < current;
                const active = i === current;
                const pending = i > current;
                return (
                  <div key={step.id} className="flex gap-4 relative">
                    {/* Vertical line */}
                    {i < STEPS.length - 1 && (
                      <div className="absolute left-5 top-10 bottom-0 w-px bg-zinc-100">
                        {done && (
                          <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            className="w-full bg-brand-primary origin-top"
                            style={{ height: "100%" }}
                          />
                        )}
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 transition-all ${
                      done ? "bg-brand-primary text-white" :
                      active ? "bg-zinc-900 text-white ring-4 ring-zinc-900/10" :
                      "bg-zinc-50 text-zinc-300 border border-zinc-100"
                    }`}>
                      <step.icon className="w-4 h-4" />
                    </div>

                    {/* Text */}
                    <div className={`pb-8 pt-1.5 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                      <p className={`text-sm font-semibold ${pending ? "text-zinc-300" : "text-zinc-900"}`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${pending ? "text-zinc-200" : "text-zinc-400"}`}>
                        {step.desc}
                      </p>
                    </div>

                    {active && (
                      <div className="ml-auto pt-1.5">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-brand-primary uppercase tracking-widest">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                          Now
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery & Rider */}
        <div className="bg-white rounded-2xl border border-zinc-100 card-shadow p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Delivery Address</p>
              <p className="text-sm font-medium text-zinc-900">
                {order.delivery_address_text ?? "Address not set"}
              </p>
              {order.delivery_address_label && (
                <span className="inline-block mt-1 text-[10px] font-semibold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {order.delivery_address_label}
                </span>
              )}
            </div>
          </div>

          {(order.rider_name || order.status === "out_for_delivery") && (
            <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <Bike className="w-4 h-4 text-zinc-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Rider</p>
                  <p className="text-sm font-medium text-zinc-900">{order.rider_name ?? "Assigning…"}</p>
                </div>
              </div>
              
              {order.status === "out_for_delivery" && order.delivery_otp ? (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Delivery OTP</p>
                  <p className="text-xl font-bold tracking-[0.2em] text-zinc-900 bg-zinc-100 px-3 py-1 rounded-lg">{order.delivery_otp}</p>
                </div>
              ) : (order.status !== "delivered" && order.status !== "cancelled" && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Delivery OTP</p>
                  <div className="flex items-center justify-end gap-1.5 mt-1 bg-zinc-50 px-2 py-1 rounded-lg border border-zinc-100">
                    <Lock className="w-3 h-3 text-zinc-400" />
                    <span className="text-[10px] font-semibold text-zinc-400">Hidden till delivery</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order items */}
        <div className="bg-white rounded-2xl border border-zinc-100 card-shadow p-5">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Items Ordered</h3>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-400 w-6">{item.quantity}×</span>
                  <span className="text-sm font-medium text-zinc-800">{item.menu_item_name}</span>
                </div>
                <span className="text-sm font-semibold text-zinc-900">₹{(item.price_paise * item.quantity) / 100}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 mt-4 border-t border-zinc-50 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-500">Subtotal</span>
              <span className="text-sm font-medium text-zinc-800">₹{(order.subtotal_paise ?? 0) / 100}</span>
            </div>
            {(order.delivery_fee_paise > 0 || order.surge_paise > 0) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Delivery & Surge</span>
                <span className="text-sm font-medium text-zinc-800">₹{((order.delivery_fee_paise ?? 0) + (order.surge_paise ?? 0)) / 100}</span>
              </div>
            )}
            {order.discount_paise > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Promo Discount</span>
                <span className="text-sm font-bold text-green-600">-₹{order.discount_paise / 100}</span>
              </div>
            )}
            {order.loyalty_discount_paise > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Loyalty Discount</span>
                <span className="text-sm font-bold text-green-600">-₹{order.loyalty_discount_paise / 100}</span>
              </div>
            )}
            {order.wallet_deduction_paise > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Wallet Deduction</span>
                <span className="text-sm font-bold text-brand-primary">-₹{order.wallet_deduction_paise / 100}</span>
              </div>
            )}
            {((order.cgst_paise ?? 0) + (order.sgst_paise ?? 0) > 0) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Taxes (CGST + SGST)</span>
                <span className="text-sm font-medium text-zinc-800">₹{((order.cgst_paise ?? 0) + (order.sgst_paise ?? 0)) / 100}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-zinc-100">
              <span className="text-sm font-semibold text-zinc-500">Total</span>
              <span className="text-base font-bold text-zinc-900">₹{order.total_amount_paise / 100}</span>
            </div>
          </div>
        </div>

        {/* Live Tracking Map Component */}
        {order.status === "out_for_delivery" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-6 shadow-xl border border-zinc-200"
          >
            <LiveTrackingMap 
              kitchenLat={order.kitchen_lat ? Number(order.kitchen_lat) : undefined}
              kitchenLng={order.kitchen_lng ? Number(order.kitchen_lng) : undefined}
              customerLat={order.customer_lat ? Number(order.customer_lat) : undefined}
              customerLng={order.customer_lng ? Number(order.customer_lng) : undefined}
              initialRiderLat={order.rider_lat ? Number(order.rider_lat) : undefined}
              initialRiderLng={order.rider_lng ? Number(order.rider_lng) : undefined}
              liveRiderLat={liveRiderLocation?.lat}
              liveRiderLng={liveRiderLocation?.lng}
            />
          </motion.div>
        )}

        {/* Feedback — shown only for delivered orders */}
        {order.status === "delivered" && (
          <div className="bg-white rounded-2xl border border-zinc-100 card-shadow p-5">
            {feedbackSubmitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-zinc-900">Thanks for your feedback!</p>
                <p className="text-xs text-zinc-400 mt-1">You earned 10 loyalty points.</p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-bold text-zinc-900 mb-4">Rate Your Experience</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Food Quality</p>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setFoodRating(n)} className="p-1">
                          <Star className={`w-7 h-7 transition-colors ${n <= foodRating ? "text-amber-400 fill-amber-400" : "text-zinc-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Delivery Experience</p>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setDeliveryRating(n)} className="p-1">
                          <Star className={`w-7 h-7 transition-colors ${n <= deliveryRating ? "text-amber-400 fill-amber-400" : "text-zinc-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={e => setFeedbackComment(e.target.value)}
                    placeholder="Tell us more (optional)…"
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
                      } finally {
                        setFeedbackLoading(false);
                      }
                    }}
                    className="w-full bg-brand-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-primary-dark transition-all disabled:opacity-50"
                  >
                    {feedbackLoading ? "Submitting…" : "Submit Feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Cancel Order */}
        {["confirmed", "preparing"].includes(order.status) && (
          <div className="bg-red-50 rounded-2xl border border-red-100 card-shadow p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">Cancel Order</p>
              <p className="text-xs text-red-400">Refund will be credited to your wallet</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Are you sure you want to cancel this order?")) return;
                try {
                  await api.post(`/orders/${order.id}/cancel`, {});
                  setOrder(prev => prev ? { ...prev, status: "cancelled" } : null);
                  toast.success("Order cancelled. Refund initiated.");
                } catch (e: any) {
                  toast.error(e.message || "Failed to cancel order");
                }
              }}
              className="bg-red-100 text-red-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-red-200 transition-all"
            >
              Cancel Order
            </button>
          </div>
        )}

        {/* Help */}
        <div className="bg-white rounded-2xl border border-zinc-100 card-shadow p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Need help?</p>
            <p className="text-xs text-zinc-400">Support available 24/7</p>
          </div>
          <Link href="/profile?tab=support" className="bg-zinc-100 text-zinc-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-zinc-200 transition-all">
            Contact Us
          </Link>
        </div>
      </main>
    </div>
  );
}
