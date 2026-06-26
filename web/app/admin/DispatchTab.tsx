"use client";
import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Phone, ChevronLeft, ChevronRight, Package, User, Bike, Clock, Banknote, Smartphone, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  preparing: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  ready_for_pickup: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  out_for_delivery: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  delivered: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
};

const PAY_COLORS: Record<string, string> = {
  paid: "text-emerald-400 bg-emerald-400/10",
  cod_pending: "text-amber-400 bg-amber-400/10",
  pending: "text-zinc-400 bg-white/5",
  refunded: "text-red-400 bg-red-400/10",
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function rupees(paise: number) {
  return "₹" + (paise / 100).toFixed(0);
}

export function DispatchTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (date) params.set("date", date);
      const d = await api.get(`/admin/orders/dispatch?${params}`);
      setOrders(d.orders ?? []);
      setTotal(d.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [search, status, date, page]);

  useEffect(() => { load(1); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1);
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-white">Dispatch Log</h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Full order–rider assignment history · {total} records</p>
        </div>
        <button
          onClick={() => load(page)}
          className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Order ID · Customer · Rider · Phone…"
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-colors">
            Search
          </button>
        </form>

        <select
          value={status}
          onChange={e => { setStatus(e.target.value); }}
          className="px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-zinc-300 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-zinc-300 focus:outline-none"
        />

        {(search || status || date) && (
          <button
            onClick={() => { setSearch(""); setStatus(""); setDate(""); setTimeout(() => load(1), 0); }}
            className="px-3 py-2.5 text-zinc-500 hover:text-white text-sm font-bold transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center">
            <Package className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">No orders found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">

              {/* Row summary */}
              <button
                className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-4 flex-wrap">

                  {/* Order ID + time */}
                  <div className="min-w-[110px]">
                    <div className="text-white font-black text-sm tracking-tight font-mono">{order.display_id || order.id.slice(-6).toUpperCase()}</div>
                    <div className="text-zinc-600 text-[10px] mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{fmt(order.created_at)}
                    </div>
                  </div>

                  {/* Status */}
                  <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${STATUS_COLORS[order.status] ?? "text-zinc-400 bg-white/5"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>

                  {/* Customer */}
                  <div className="flex items-center gap-2 min-w-[140px] flex-1">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-bold">{order.customer_name}</div>
                      <a
                        href={`tel:${order.customer_phone}`}
                        onClick={e => e.stopPropagation()}
                        className="text-zinc-500 text-[11px] hover:text-emerald-400 flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />{order.customer_phone}
                      </a>
                    </div>
                  </div>

                  {/* Rider */}
                  <div className="flex items-center gap-2 min-w-[140px] flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${order.rider_name ? "bg-emerald-500/10" : "bg-white/[0.04]"}`}>
                      <Bike className={`w-4 h-4 ${order.rider_name ? "text-emerald-400" : "text-zinc-600"}`} />
                    </div>
                    <div>
                      <div className="text-white text-sm font-bold">{order.rider_name ?? <span className="text-zinc-600 font-normal">Unassigned</span>}</div>
                      {order.rider_phone ? (
                        <a
                          href={`tel:${order.rider_phone}`}
                          onClick={e => e.stopPropagation()}
                          className="text-zinc-500 text-[11px] hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          <Phone className="w-3 h-3" />{order.rider_phone}
                        </a>
                      ) : <span className="text-zinc-600 text-[11px]">—</span>}
                    </div>
                  </div>

                  {/* Amount + payment */}
                  <div className="text-right ml-auto">
                    <div className="text-white font-black text-base">{rupees(order.total_amount_paise)}</div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      {order.payment_method === 'cod' ? <Banknote className="w-3 h-3 text-zinc-500" /> : <Smartphone className="w-3 h-3 text-zinc-500" />}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${PAY_COLORS[order.payment_status] ?? "text-zinc-400 bg-white/5"}`}>
                        {order.payment_status?.replace(/_/g, " ") ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === order.id && (
                <div className="border-t border-white/[0.06] px-5 py-4 bg-black/20 grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Items */}
                  <div>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Order Items</p>
                    {(order.items ?? []).length === 0 ? (
                      <p className="text-zinc-600 text-sm">—</p>
                    ) : (
                      <ul className="space-y-1">
                        {order.items.map((item: any, i: number) => (
                          <li key={i} className="text-zinc-300 text-sm flex justify-between">
                            <span>{item.name}</span>
                            <span className="text-zinc-600 font-mono">×{item.qty}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Timeline</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Ordered</span>
                      <span className="text-zinc-300 font-mono text-xs">{fmt(order.created_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Delivered</span>
                      <span className="text-zinc-300 font-mono text-xs">{fmt(order.delivered_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Payment collected</span>
                      <span className="text-zinc-300 font-mono text-xs">{fmt(order.cod_collected_at)}</span>
                    </div>
                  </div>

                  {/* IDs for dispute */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Reference IDs</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Order UUID</span>
                      <span className="text-zinc-500 font-mono text-[10px]">{order.id.slice(0, 8)}…</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Customer ID</span>
                      <span className="text-zinc-500 font-mono text-[10px]">{order.customer_id?.slice(0, 8) ?? "—"}…</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Rider ID</span>
                      <span className="text-zinc-500 font-mono text-[10px]">{order.rider_id ? order.rider_id.slice(0, 8) + "…" : "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Pay method</span>
                      <span className="text-white text-sm font-bold uppercase">{order.payment_method}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
          <span className="text-zinc-500 text-sm">Page {page} of {totalPages} · {total} orders</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => load(page + 1)}
              className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
