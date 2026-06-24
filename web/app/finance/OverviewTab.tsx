"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Wallet, Bike, Utensils, AlertCircle,
  ArrowUpRight, RefreshCw, IndianRupee, Package, Clock
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
const fmtK = (paise: number) => paise >= 100000 ? `₹${(paise / 100000).toFixed(1)}L` : fmt(paise);

function StatCard({ label, value, sub, icon: Icon, color, trend }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
      {sub && <div className="text-xs text-white/40">{sub}</div>}
      {trend != null && (
        <div className={`text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          <ArrowUpRight className="w-3 h-3" style={{ transform: trend < 0 ? 'rotate(180deg)' : undefined }} />
          {Math.abs(trend)}% vs yesterday
        </div>
      )}
    </motion.div>
  );
}

function WeeklyChart({ data }: { data: { date: string; revenue_paise: number; orders: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Number(d.revenue_paise))) || 1;
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return (
    <div className="flex items-end gap-2 h-24 mt-2">
      {data.map((d, i) => {
        const pct = (Number(d.revenue_paise) / max) * 100;
        const day = days[new Date(d.date).getDay()];
        const isToday = d.date === new Date().toISOString().split("T")[0];
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end" style={{ height: 72 }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, 4)}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className={`w-full rounded-t-md ${isToday ? 'bg-emerald-500' : 'bg-white/10 group-hover:bg-white/20'} transition-colors`}
                style={{ position: 'absolute', bottom: 0 }}
              />
            </div>
            <span className={`text-[10px] font-bold ${isToday ? 'text-emerald-400' : 'text-white/30'}`}>{day}</span>
          </div>
        );
      })}
    </div>
  );
}

function CODAlert({ riders }: { riders: any[] }) {
  if (!riders.length) return null;
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-amber-400">COD Cash In Transit</span>
      </div>
      <div className="space-y-2">
        {riders.slice(0, 5).map((r: any) => (
          <div key={r.rider_id} className="flex items-center justify-between">
            <div>
              <span className="text-sm text-white font-semibold">{r.rider_name}</span>
              <span className="text-xs text-white/40 ml-2">{r.order_count} orders</span>
            </div>
            <span className="text-sm font-black text-amber-400">{fmt(parseInt(r.cash_pending_paise, 10))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/summary?date=${date}`);
      setData(res);
    } catch {
      toast.error("Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 text-white/20 animate-spin" />
    </div>
  );
  if (!data) return null;

  const rev = data.todayRevenue;
  const deliveryPlatformCut = Math.round(rev.deliveryFeePaise * 0.25);
  const platformRevenue = rev.commissionEarnedPaise + deliveryPlatformCut;

  return (
    <div className="p-6 space-y-6">
      {/* Date picker + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Daily P&L</h2>
          <p className="text-white/40 text-sm mt-0.5">Real-time financial summary</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
          />
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <RefreshCw className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Revenue" value={fmtK(rev.grossRevenuePaise)} sub={`${rev.deliveredCount} delivered orders`} icon={TrendingUp} color="#10b981" />
        <StatCard label="Platform Revenue" value={fmtK(platformRevenue)} sub="Commission + delivery cut" icon={IndianRupee} color="#f59e0b" />
        <StatCard label="Rider Payouts Due" value={fmtK(data.riderPayoutsDue.pendingPaise)} sub={`${data.riderPayoutsDue.pendingCount} pending requests`} icon={Bike} color="#6366f1" />
        <StatCard label="Kitchen Payouts Due" value={fmtK(data.kitchenPayoutsDue.pendingPaise)} sub={`${data.kitchenPayoutsDue.pendingCount} pending`} icon={Utensils} color="#ec4899" />
      </div>

      {/* Revenue breakdown + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-white/80">7-Day Revenue</span>
            <span className="text-xs text-white/30">tap bars for details</span>
          </div>
          <WeeklyChart data={data.weeklyRevenue} />
        </div>

        <div className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <span className="text-sm font-bold text-white/80">Today Breakdown</span>
          {[
            { label: "Online Payments", value: rev.onlineRevenuePaise, color: "#10b981" },
            { label: "COD Collected", value: rev.codRevenuePaise, color: "#f59e0b" },
            { label: "COD Pending", value: rev.codPendingRevenuePaise, color: "#f97316" },
            { label: "Delivery Fees", value: rev.deliveryFeePaise, color: "#6366f1" },
            { label: "Commission Earned", value: rev.commissionEarnedPaise, color: "#ec4899" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-white/50">{item.label}</span>
              </div>
              <span className="text-sm font-bold text-white">{fmt(item.value)}</span>
            </div>
          ))}
          <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-white/80">Active Orders</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-black text-emerald-400">{rev.activeOrders}</span>
            </div>
          </div>
        </div>
      </div>

      {/* COD Alert */}
      <CODAlert riders={data.codPendingRiders} />
    </div>
  );
}
