import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Target, TrendingUp, Trophy, Star, Flame, CheckCircle, Clock, Loader2, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

const ICONS: Record<string, any> = {
  zap: Zap, target: Target, "trending-up": TrendingUp,
  trophy: Trophy, star: Star, flame: Flame,
};

function getResetLabel(windowType: string): string {
  const now = new Date();
  if (windowType === "daily") {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diffH = Math.ceil((tomorrow.getTime() - now.getTime()) / 3600000);
    return `Resets in ${diffH}h`;
  }
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : 8 - day;
  return `Resets in ${daysToMon}d`;
}

function TierBar({ tiers, progress, color }: { tiers: any[]; progress: number; color: string }) {
  if (!tiers.length) return null;
  const maxTarget = tiers[tiers.length - 1].target;
  const pct = Math.min((progress / maxTarget) * 100, 100);

  return (
    <div className="mt-4">
      <div className="h-1.5 bg-zinc-800 rounded-full relative w-full mb-1">
        <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
        {tiers.slice(0, -1).map((t, i) => {
          const markerPct = (t.target / maxTarget) * 100;
          const reached = progress >= t.target;
          return (
            <div key={i} className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full border-2 border-zinc-900 bg-zinc-800 transition-colors" style={{ left: `${markerPct}%`, backgroundColor: reached ? color : undefined, borderColor: reached ? color : undefined }} />
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {tiers.map((t, i) => {
          const reached = progress >= t.target;
          return (
            <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold ${reached ? "bg-white/10" : "bg-transparent border-transparent text-zinc-600"}`} style={{ borderColor: reached ? color : undefined, color: reached ? color : undefined }}>
              <Star className="w-3 h-3" /> +₹{(t.reward_paise / 100).toFixed(0)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionCard({ m }: { m: any }) {
  const tiers = m.tiers || [];
  const isDone = m.status === "completed";
  const color = isDone ? "#22C55E" : m.color || "#FF6B35";
  const maxTarget = tiers[tiers.length - 1]?.target || 1;
  const isEarnings = m.type === "earnings_amount";
  const progressLabel = isEarnings
    ? `₹${Math.floor(m.progress / 100)} / ₹${Math.floor(maxTarget / 100)}`
    : `${m.progress} / ${maxTarget}`;
  const IconComp = ICONS[m.icon] || Zap;
  const totalBonus = tiers.reduce((s: number, t: any) => s + t.reward_paise, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-5 rounded-2xl border transition-all ${isDone ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-900 border-white/10"}`}>
      <div className="flex gap-4 items-start">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
          <IconComp className="w-6 h-6" style={{ color }} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-white leading-tight">{m.title}</h3>
          <p className="text-xs text-zinc-500 mt-1">{m.description}</p>
        </div>
        <div className="shrink-0">
          {isDone ? (
            <div className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">Done</div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-black" style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}>
              <Star className="w-3 h-3" /> +₹{(totalBonus / 100).toFixed(0)}
            </div>
          )}
        </div>
      </div>

      <TierBar tiers={tiers} progress={m.progress} color={color} />

      <div className="flex items-center justify-between mt-4 text-xs font-bold">
        <div style={{ color: isDone ? "#22C55E" : "#71717A" }}>
          {isDone ? "✓ All tiers completed!" : progressLabel}
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 bg-white/5 px-2 py-1 rounded-md">
          <Clock className="w-3.5 h-3.5" />
          <span>{getResetLabel(m.windowType)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function StreakCard({ current, longest }: { current: number; longest: number }) {
  return (
    <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🔥</span>
        <div>
          <div className="text-xl font-black text-orange-500">{current} Day Streak</div>
          <div className="text-xs font-bold text-orange-500/60 mt-0.5">Best: {longest} days</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map(d => (
          <div key={d} className={`w-3 h-3 rounded-full ${d <= current % 7 || current >= 7 ? "bg-orange-500" : "bg-zinc-800"}`} />
        ))}
      </div>
    </div>
  );
}

export function RiderMissionsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      const res = await api.get("/missions/rider");
      setData(res);
    } catch (e: any) {
      toast.error(e.message || "Failed to load missions");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const missions = data?.missions ?? [];
  const daily = missions.filter((m: any) => m.windowType === "daily");
  const weekly = missions.filter((m: any) => m.windowType === "weekly");
  const dailyDone = daily.filter((m: any) => m.status === "completed").length;

  return (
    <div className="space-y-6 pb-24">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <Zap className="w-5 h-5 text-orange-500 mb-2" />
          <div className="text-lg font-black text-white">₹{((data?.todayEarningsPaise ?? 0) / 100).toFixed(0)}</div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Today</div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
          <div className="text-lg font-black text-white">{data?.todayDeliveries ?? 0}</div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Deliveries</div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <Trophy className="w-5 h-5 text-amber-500 mb-2" />
          <div className="text-lg font-black text-white">₹{((data?.weekEarningsPaise ?? 0) / 100).toFixed(0)}</div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">This Week</div>
        </div>
      </div>

      <StreakCard current={data?.currentStreak ?? 0} longest={data?.longestStreak ?? 0} />

      {daily.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Today's Missions</h3>
            <span className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded font-black ml-2">{dailyDone}/{daily.length}</span>
          </div>
          {daily.map((m: any) => <MissionCard key={m.id} m={m} />)}
        </div>
      )}

      {weekly.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Weekly Challenge</h3>
          </div>
          {weekly.map((m: any) => <MissionCard key={m.id} m={m} />)}
        </div>
      )}

      {missions.length === 0 && (
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-10 flex flex-col items-center text-center">
          <Target className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-lg font-black text-white">No active missions</h3>
          <p className="text-sm text-zinc-500 mt-2 font-medium">Check back later for new earning opportunities!</p>
        </div>
      )}
    </div>
  );
}
