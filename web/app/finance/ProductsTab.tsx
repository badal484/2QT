"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

export function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    kitchenId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.kitchenId && { kitchenId: filters.kitchenId }),
      });
      const res = await api.get(`/finance/products/revenue?${params}`);
      setProducts(res.products || []);
    } catch {
      toast.error("Failed to load product revenue");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["inventory_updated"], load);

  const totalRevenue = products.reduce((s, p) => s + parseInt(p.total_revenue_paise), 0);
  const totalUnits = products.reduce((s, p) => s + parseInt(p.total_quantity), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Product Revenue</h2>
          <p className="text-white/40 text-sm mt-0.5">Per item breakdown</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/40 font-semibold">From</label>
          <input type="date" value={filters.startDate}
            onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/40 font-semibold">To</label>
          <input type="date" value={filters.endDate}
            onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
        </div>
      </div>

      {/* Summary */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Revenue", value: fmt(totalRevenue), color: "#10b981" },
            { label: "Units Sold", value: totalUnits.toLocaleString(), color: "#6366f1" },
            { label: "Avg per Item", value: fmt(Math.round(totalRevenue / (products.length || 1))), color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} className="bg-[#0d0d1a] border border-white/[0.07] rounded-xl p-4">
              <div className="text-xs text-white/30 font-semibold">{s.label}</div>
              <div className="text-xl font-black mt-1" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <TrendingUp className="w-10 h-10 text-white/10" />
          <p className="text-white/30 text-sm">No delivered orders in this date range.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="text-left text-xs text-white/30 font-semibold uppercase tracking-wider px-5 py-3">#</th>
                <th className="text-left text-xs text-white/30 font-semibold uppercase tracking-wider px-4 py-3">Item</th>
                <th className="text-left text-xs text-white/30 font-semibold uppercase tracking-wider px-4 py-3">Kitchen</th>
                <th className="text-right text-xs text-white/30 font-semibold uppercase tracking-wider px-4 py-3">Units</th>
                <th className="text-right text-xs text-white/30 font-semibold uppercase tracking-wider px-4 py-3">Avg Price</th>
                <th className="text-right text-xs text-white/30 font-semibold uppercase tracking-wider px-5 py-3">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {products.map((p: any, i: number) => {
                const revPct = totalRevenue > 0 ? (parseInt(p.total_revenue_paise) / totalRevenue) * 100 : 0;
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-xs text-white/20 font-mono">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="mt-1 h-1.5 bg-white/5 rounded-full w-32">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${revPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-white/40">{p.kitchen_name}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold text-white">{parseInt(p.total_quantity).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-xs text-white/40">{fmt(Math.round(parseFloat(p.avg_price_paise)))}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-black text-emerald-400">{fmt(parseInt(p.total_revenue_paise))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
