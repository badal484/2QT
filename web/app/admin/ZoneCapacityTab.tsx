"use client";

import { useState, useEffect } from "react";
import { Package, Users, ChevronDown, ChevronUp, Info } from "lucide-react";
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

function ZoneCard({ zone, onSave }: { zone: any; onSave: (id: string, cap: number) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number>(zone.max_concurrent_orders ?? 1);
  const [saving, setSaving] = useState(false);
  const changed = selected !== (zone.max_concurrent_orders ?? 1);
  const currentOpt = CAP_OPTIONS.find(o => o.value === (zone.max_concurrent_orders ?? 1));

  const handleSave = async () => {
    setSaving(true);
    await onSave(zone.id, selected);
    setSaving(false);
  };

  return (
    <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${zone.is_active ? "bg-emerald-500" : "bg-zinc-600"}`} />
        <div className="flex-1">
          <p className="text-white font-black text-sm">{zone.name}</p>
          {currentOpt && (
            <span
              className={`inline-flex items-center mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentOpt.badge}`}
            >
              {currentOpt.label}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        )}
      </button>

      {/* Picker */}
      {expanded && (
        <div className="border-t border-white/[0.07] p-4 space-y-3">
          {CAP_OPTIONS.map(opt => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  active
                    ? "border-opacity-100"
                    : "border-white/[0.07] hover:border-white/20"
                }`}
                style={active ? { borderColor: opt.color, backgroundColor: opt.color + "11" } : {}}
              >
                {/* Radio */}
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                  style={active ? { borderColor: opt.color } : { borderColor: "#374151" }}
                >
                  {active && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                  )}
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

          {changed && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black text-sm transition-colors mt-1"
            >
              {saving ? "Saving…" : `Save for ${zone.name}`}
            </button>
          )}
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

  const phase1 = zones.filter(z => (z.max_concurrent_orders ?? 1) === 1).length;
  const phase2 = zones.filter(z => (z.max_concurrent_orders ?? 1) === 2).length;

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
        <h2 className="text-xl font-black text-white">Order Capacity</h2>
        <p className="text-zinc-500 text-sm mt-1">Configure per-zone concurrent order limits for riders</p>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 bg-orange-500/[0.07] border border-orange-500/20 rounded-2xl p-4">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-orange-300 font-bold text-sm">Phase 1 → Phase 2 in one tap</p>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            Set each zone independently. Phase 1 (1 order) is always safe. Phase 2 (2 orders) only
            stacks when the 2nd order is from the exact same kitchen and the rider hasn't left for
            delivery yet.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-2xl font-black text-white">{phase1}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-semibold">Phase 1 zones</span>
        </div>
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-2xl font-black text-white">{phase2}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-semibold">Phase 2 zones</span>
        </div>
        <div className="bg-[#0f0f1a] border border-white/[0.07] rounded-xl p-4 flex flex-col items-center gap-1">
          <span className="text-2xl font-black text-white">{zones.length}</span>
          <span className="text-[11px] text-zinc-500 font-semibold">Total zones</span>
        </div>
      </div>

      {/* Zone cards */}
      <div className="space-y-3">
        {zones.map(zone => (
          <ZoneCard key={zone.id} zone={zone} onSave={handleSave} />
        ))}
        {zones.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">No zones configured yet.</p>
        )}
      </div>
    </div>
  );
}
