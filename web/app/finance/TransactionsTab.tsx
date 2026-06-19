"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Download, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

const STATUS_COLORS: Record<string, string> = {
  delivered: "text-emerald-400 bg-emerald-400/10",
  cancelled: "text-red-400 bg-red-400/10",
  pending: "text-yellow-400 bg-yellow-400/10",
  confirmed: "text-blue-400 bg-blue-400/10",
  preparing: "text-orange-400 bg-orange-400/10",
  ready_for_pickup: "text-purple-400 bg-purple-400/10",
  out_for_delivery: "text-cyan-400 bg-cyan-400/10",
};

const PAYMENT_COLORS: Record<string, string> = {
  cod: "text-amber-400 bg-amber-400/10",
  razorpay: "text-blue-400 bg-blue-400/10",
  upi: "text-green-400 bg-green-400/10",
};

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 30;

  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    status: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.status && { status: filters.status }),
      });
      const res = await api.get(`/finance/transactions?${params}`);
      setTransactions(res.transactions || []);
      setTotal(res.total || 0);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        export: "csv",
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.status && { status: filters.status }),
      });
      // Open in new tab to trigger download
      const token = localStorage.getItem("2qt_token") || "";
      const url = `/api/proxy/finance/transactions?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-Pinggy-No-Screen": "true" } });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `transactions-${filters.startDate}-to-${filters.endDate}.csv`;
      a.click();
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const grossTotal = transactions.filter(t => t.status === "delivered").reduce((s, t) => s + parseInt(t.total_amount_paise), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Transaction Ledger</h2>
          <p className="text-white/40 text-sm mt-0.5">{total.toLocaleString()} total records</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showFilters ? "bg-white/10 text-white" : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"}`}>
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button onClick={exportCSV} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">From</label>
            <input type="date" value={filters.startDate}
              onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setPage(0); }}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">To</label>
            <input type="date" value={filters.endDate}
              onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setPage(0); }}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Payment</label>
            <select value={filters.paymentMethod}
              onChange={e => { setFilters(f => ({ ...f, paymentMethod: e.target.value })); setPage(0); }}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50">
              <option value="">All</option>
              <option value="cod">COD</option>
              <option value="razorpay">Razorpay</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Status</label>
            <select value={filters.status}
              onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50">
              <option value="">All</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending">Pending</option>
              <option value="out_for_delivery">Out for Delivery</option>
            </select>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {!loading && transactions.length > 0 && (
        <div className="flex items-center gap-6 text-sm">
          <span className="text-white/30">Showing <span className="text-white font-bold">{transactions.length}</span> of {total}</span>
          <span className="text-white/30">Page revenue: <span className="text-emerald-400 font-black">{fmt(grossTotal)}</span></span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Order ID", "Date", "Customer", "Kitchen", "Rider", "Payment", "Status", "Total", "Commission"].map(h => (
                    <th key={h} className="text-left text-xs text-white/30 font-semibold uppercase tracking-wider px-4 py-3 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {transactions.map((t: any) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 pl-5 font-mono text-xs text-white/60">#{t.display_id}</td>
                    <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60 max-w-[100px] truncate">{t.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-white/60 max-w-[100px] truncate">{t.kitchen_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-white/60 max-w-[80px] truncate">{t.rider_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md capitalize ${PAYMENT_COLORS[t.payment_method] || "text-white/40 bg-white/5"}`}>
                        {t.payment_method?.toUpperCase()}
                        {t.payment_method === "cod" && !t.cod_cash_collected && " ⏳"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md capitalize ${STATUS_COLORS[t.status] || "text-white/40 bg-white/5"}`}>
                        {t.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-black text-white">{fmt(parseInt(t.total_amount_paise))}</td>
                    <td className="px-4 py-3 pr-5 text-xs font-bold text-emerald-400">
                      {parseInt(t.commission_paise) > 0 ? fmt(parseInt(t.commission_paise)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.05]">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs text-white/30">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
