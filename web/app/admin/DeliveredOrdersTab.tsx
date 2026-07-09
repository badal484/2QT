"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Camera, Package, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

export function DeliveredOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [podFilter, setPodFilter] = useState<"all" | "with_pod" | "without_pod">("all");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getDeliveredOrders();
      setOrders(d.orders ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load delivered orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = orders.filter(o => {
    if (podFilter === "with_pod")    return !!o.pod_photo_url;
    if (podFilter === "without_pod") return !o.pod_photo_url;
    return true;
  });

  const withPodCount    = orders.filter(o => !!o.pod_photo_url).length;
  const withoutPodCount = orders.filter(o => !o.pod_photo_url).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Delivered Orders</h2>
          <p className="text-zinc-400 text-sm font-medium">
            Last 100 deliveries with proof-of-delivery photos.
          </p>
          <div className="flex gap-4 mt-2 text-xs font-bold">
            <span className="text-emerald-400">{withPodCount} with POD photo</span>
            <span className="text-zinc-500">{withoutPodCount} without photo</span>
          </div>
        </div>
        <button
          onClick={load}
          className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {(["all", "with_pod", "without_pod"] as const).map(f => (
          <button
            key={f}
            onClick={() => setPodFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              podFilter === f
                ? "bg-white/10 text-white"
                : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/5"
            }`}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white/[0.02] rounded-2xl animate-pulse border border-white/5" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white/[0.01] border border-white/5 rounded-[32px]">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
          <p className="text-white font-black text-xl mb-1">No orders found</p>
          <p className="text-zinc-500 text-sm">Try a different filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(order => (
            <div
              key={order.id}
              className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex items-center gap-6 hover:border-white/15 transition-all"
            >
              {/* POD photo thumbnail */}
              <div className="shrink-0">
                {order.pod_photo_url ? (
                  <button
                    onClick={() => setLightboxUrl(order.pod_photo_url)}
                    className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all group relative"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.pod_photo_url}
                      alt="POD"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/5 border-dashed flex items-center justify-center">
                    <Camera className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
              </div>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-white text-sm">#{order.display_id}</span>
                  <span className="text-zinc-500 text-xs">·</span>
                  <span className="text-zinc-300 text-sm">{order.customer_name}</span>
                  <span
                    className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      order.pod_photo_url
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {order.pod_photo_url ? "POD ✓" : "No photo"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {order.rider_name || "Unassigned"}
                  </span>
                  <span>₹{(order.total_amount_paise / 100).toLocaleString("en-IN")}</span>
                  <span className="uppercase font-bold">{order.payment_method}</span>
                  <span>
                    {order.delivered_at
                      ? new Date(order.delivered_at).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
                {/* Items */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {(order.items ?? []).filter((i: any) => i.menu_item_name).slice(0, 4).map((item: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-[10px] text-zinc-400 font-medium"
                    >
                      {item.quantity}× {item.menu_item_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Proof of Delivery"
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
