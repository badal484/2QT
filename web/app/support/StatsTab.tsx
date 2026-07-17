"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, Clock, AlertTriangle, CheckCircle2, Users, BarChart3 } from "lucide-react";
import { api } from "../lib/api";
import { SkeletonList, SkeletonStatCard } from "../components/ui/Skeleton";
import { ScreenError } from "../components/ui/ScreenError";

interface Stats {
  open_count: number;
  in_progress_count: number;
  resolved_today: number;
  critical_open: number;
  sla_breached: number;
  avg_resolution_hours: number;
  rider_tickets_total: number;
  customer_tickets_total: number;
}

interface Agent {
  id: string;
  name: string;
  phone: string;
  open_count?: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  border: string;
}

function StatCard({ label, value, sub, icon: Icon, color, border }: StatCardProps) {
  return (
    <div className={`bg-[#11111a] border ${border} rounded-2xl p-5 space-y-3`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color.replace("text-", "bg-").replace("400", "500/15")}`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider ${color} mb-1`}>{label}</p>
        <p className="text-3xl font-black text-white">{value}</p>
        {sub && <p className="text-sm text-zinc-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function StatsTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["support-stats"],
    queryFn: async () => {
      const res = await api.get("/support/stats");
      return { stats: res.stats as Stats, agents: (res.agents ?? []) as Agent[] };
    },
    refetchInterval: 60000,
  });

  if (isError) {
    return <ScreenError onRetry={refetch} message={(error as any)?.message || "Failed to load stats"} />;
  }

  const stats = data?.stats;
  const agents = data?.agents ?? [];
  const total = (stats?.rider_tickets_total ?? 0) + (stats?.customer_tickets_total ?? 0);
  const riderPct  = total > 0 ? Math.round(((stats?.rider_tickets_total ?? 0) / total) * 100) : 0;
  const custPct   = total > 0 ? Math.round(((stats?.customer_tickets_total ?? 0) / total) * 100) : 0;

  const STAT_CARDS: StatCardProps[] = [
    {
      label: "Open",
      value: stats?.open_count ?? "—",
      sub: "Awaiting assignment or action",
      icon: TrendingUp,
      color: "text-sky-400",
      border: "border-sky-500/20",
    },
    {
      label: "In Progress",
      value: stats?.in_progress_count ?? "—",
      sub: "Being worked on",
      icon: Clock,
      color: "text-blue-400",
      border: "border-blue-500/20",
    },
    {
      label: "Resolved Today",
      value: stats?.resolved_today ?? "—",
      sub: "Great work!",
      icon: CheckCircle2,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
    },
    {
      label: "Critical Open",
      value: stats?.critical_open ?? "—",
      sub: "Requires immediate attention",
      icon: AlertTriangle,
      color: "text-red-400",
      border: "border-red-500/20",
    },
    {
      label: "SLA Breached",
      value: stats?.sla_breached ?? "—",
      sub: "Passed deadline",
      icon: AlertTriangle,
      color: "text-orange-400",
      border: "border-orange-500/20",
    },
    {
      label: "Avg Resolution",
      value: stats ? `${(stats.avg_resolution_hours ?? 0).toFixed(1)}h` : "—",
      sub: "Average time to resolve",
      icon: Clock,
      color: "text-violet-400",
      border: "border-violet-500/20",
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-400" />
            Support Stats
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">Real-time overview of your support team performance</p>
        </div>
        <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {STAT_CARDS.map(card => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Ticket split */}
      {stats && (
        <div className="bg-[#11111a] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white/80">Ticket Split</h3>
          <div className="space-y-3">
            {/* Customer bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="text-purple-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Customers
                </span>
                <span className="text-zinc-400">{stats.customer_tickets_total} ({custPct}%)</span>
              </div>
              <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-700"
                  style={{ width: `${custPct}%` }}
                />
              </div>
            </div>
            {/* Rider bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="text-green-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  Riders
                </span>
                <span className="text-zinc-400">{stats.rider_tickets_total} ({riderPct}%)</span>
              </div>
              <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-700"
                  style={{ width: `${riderPct}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-600">{total} total tickets</p>
        </div>
      )}

      {/* Agents workload */}
      {isLoading ? (
        <SkeletonList rows={3} />
      ) : agents.length > 0 ? (
        <div className="bg-[#11111a] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-white/80">Agent Workload</h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {agents.map((agent, i) => (
              <div key={agent.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400 font-black text-xs shrink-0">
                  {agent.name?.[0]?.toUpperCase() || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate">{agent.name}</p>
                  <p className="text-xs text-zinc-600">{agent.phone}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{agent.open_count ?? 0}</p>
                  <p className="text-[10px] text-zinc-600">open tickets</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !isLoading ? (
        <div className="bg-[#11111a] border border-white/[0.06] rounded-2xl px-5 py-8 text-center">
          <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">No agents data available</p>
        </div>
      ) : null}
    </div>
  );
}
