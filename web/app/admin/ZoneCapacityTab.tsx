"use client";

import { useState, useEffect } from "react";
import { Package, Users, ChevronDown, ChevronUp, Info, Zap, Hand } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const CAP_OPTIONS = [
  {
    value: 1,
    label: "1 Order",
    sublabel: "Phase 1 — Recommended",
    desc: "Rider takes one order at a time. Food arrives hot, no routing confusion.",
    color: "#1BA672",
    bg: "#E8F8F1",
    ring: "ring-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    value: 2,
    label: "2 Orders (Smart Stack)",
    sublabel: "Phase 2 — Same kitchen only",
    desc: "System offers a 2nd order only if it's from the same kitchen and rider hasn't left yet.",
    color: "#F59E0B",
    bg: "#FFFBEB",
    ring: "ring-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

const DISPATCH_OPTIONS = [
  {
    value: "manual",
    label: "Manual",
    sublabel: "Pool broadcast",
    desc: "Order broadcasts to all zone riders at 'preparing'. First to claim wins.",
    color: "#6366F1",
    Icon: Hand,
  },
  {
    value: "auto",
    label: "Auto-Assign",
    sublabel: "Best-rider pick",
    desc: "At pickup-ready, system silently assigns the nearest idle rider. They get a 30s opt-out window.",
    color: "#FC4603",
    Icon: Zap,
  },
];

function ZoneCard({
  zone,
  onSave,
  onDispatchMode,
}: {
  zone: any;
  onSave: (id: string, cap: number) => Promise<void>;
  onDispatchMode: (id: string, mode: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number>(zone.max_concurrent_orders ?? 1);
  const [dispatchMode, setDispatchMode] = useState<string>(zone.dispatch_mode ?? "manual");
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  const capChanged = selected !== (zone.max_concurrent_orders ?? 1);
  const modeChanged = dispatchMode !== (zone.dispatch_mode ?? "manual");
  const currentOpt = CAP_OPTIONS.find(o => o.value === (zone.max_concurrent_orders ?? 1));
  const currentMode = DISPATCH_OPTIONS.find(o => o.value === (zone.dispatch_mode ?? "manual"));

  const handleSaveCap = async () => {
    setSaving(true);
    await onSave(zone.id, selected);
    setSaving(false);
  };

  const handleSaveMode = async () => {
    setSavingMode(true);
    await onDispatchMode(zone.id, dispatchMode);
    setSavingMode(false);
  };

  return (
    <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${zone.is_active ? "bg-emerald-500" : "bg-zinc-600"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm">{zone.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {currentOpt && (
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentOpt.badge}`}>
                {currentOpt.label}
              </span>
            )}
            {currentMode && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: currentMode.color + "22", color: currentMode.color }}
              >
                <currentMode.Icon className="w-2.5 h-2.5" />
                {currentMode.label}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        )}
      </button>

      {/* Expanded settings */}
      {expanded && (
        <div className="border-t border-white/[0.07] p-4 space-y-5">
          {/* Capacity picker */}
          <div>
            <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3">Order Capacity</p>
            <div className="space-y-2">
              {CAP_OPTIONS.map(opt => {
                const active = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all"
                    style={active ? { borderColor: opt.color, backgroundColor: opt.color + "11" } : { borderColor: "#374151" }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                      style={active ? { borderColor: opt.color } : { borderColor: "#374151" }}
                    >
                      {active && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-black text-sm">{opt.label}</span>
                        <span
                          className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: opt.color + "22", color: opt.color }}
                        >
                          {opt.sublabel}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {capChanged && (
              <button
                onClick={handleSaveCap}
                disabled={saving}
                className="w-full mt-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black text-sm transition-colors"
              >
                {saving ? "Saving…" : `Save Capacity for ${zone.name}`}
              </button>
            )}
          </div>

          {/* Dispatch mode picker */}
          <div>
            <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3">Dispatch Mode</p>
            <div className="space-y-2">
              {DISPATCH_OPTIONS.map(opt => {
                const active = dispatchMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDispatchMode(opt.value)}
                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all"
                    style={active ? { borderColor: opt.color, backgroundColor: opt.color + "11" } : { borderColor: "#374151" }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                      style={active ? { borderColor: opt.color } : { borderColor: "#374151" }}
                    >
                      {active && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <opt.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: opt.color }} />
                        <span className="text-white font-black text-sm">{opt.label}</span>
                        <span
                          className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: opt.color + "22", color: opt.color }}
                        >
                          {opt.sublabel}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {modeChanged && (
              <button
                onClick={handleSaveMode}
                disabled={savingMode}
                className="w-full mt-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-black text-sm transition-colors"
              >
                {savingMode ? "Saving…" : `Set ${dispatchMode === "auto" ? "Auto-Assign" : "Manual"} for ${zone.name}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ZoneCapacityTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get("/admin/zones");
      setZones(data.zones ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useSocketRefresh(["zone_updated"], load);

  const handleSave = async (id: string, cap: number) => {
    try {
      await api.patch(`/admin/zones/${id}`, { max_concurrent_orders: cap });
      setZones(prev => prev.map(z => z.id === id ? { ...z, max_concurrent_orders: cap } : z));
      toast.success("Zone capacity updated");
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Save failed");
    }
  };

  const handleDispatchMode = async (id: string, mode: string) => {
    try {
      await api.patch(`/admin/zones/${id}/dispatch-mode`, { dispatch_mode: mode });
      setZones(prev => prev.map(z => z.id === id ? { ...z, dispatch_mode: mode } : z));
      toast.success(`Dispatch mode set to ${mode === "auto" ? "Auto-Assign" : "Manual"}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Save failed");
    }
  };

  const phase1 = zones.filter(z => (z.max_concurrent_orders ?? 1) === 1).length;
  const phase2 = zones.filter(z => (z.max_concurrent_orders ?? 1) === 2).length;
  const autoZones = zones.filter(z => (z.dispatch_mode ?? "manual") === "auto").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-white">Order Capacity & Dispatch</h2>
        <p className="text-zinc-500 text-sm mt-1">Configure per-zone concurrent order limits and dispatch mode</p>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 bg-orange-500/[0.07] border border-orange-500/20 rounded-2xl p-4">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-orange-300 font-bold text-sm">Two settings per zone</p>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            <strong className="text-zinc-300">Capacity</strong> — how many concurrent orders a rider can carry (Phase 1 = 1, Phase 2 = 2).{" "}
            <strong className="text-zinc-300">Dispatch</strong> — Manual broadcasts to all riders; Auto silently assigns the nearest idle rider at pickup-ready with a 30s opt-out.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-2xl font-black text-white">{phase1}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-semibold">Phase 1</span>
        </div>
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-2xl font-black text-white">{phase2}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-semibold">Phase 2</span>
        </div>
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-2xl font-black text-white">{autoZones}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-semibold">Auto-Assign</span>
        </div>
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <span className="text-2xl font-black text-white">{zones.length}</span>
          <span className="text-[11px] text-zinc-500 font-semibold">Total zones</span>
        </div>
      </div>

      {/* Zone cards */}
      <div className="space-y-3">
        {zones.map(zone => (
          <ZoneCard key={zone.id} zone={zone} onSave={handleSave} onDispatchMode={handleDispatchMode} />
        ))}
        {zones.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">No zones configured yet.</p>
        )}
      </div>
    </div>
  );
}
