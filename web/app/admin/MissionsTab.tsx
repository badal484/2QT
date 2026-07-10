"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Zap, Target, TrendingUp, Trophy, Star, Flame, X } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";

const ICONS_LIST = ["zap", "target", "trending-up", "trophy", "star", "flame"] as const;
const ICON_COMPS: Record<string, any> = {
  zap: Zap, target: Target, "trending-up": TrendingUp,
  trophy: Trophy, star: Star, flame: Flame,
};
const COLORS_LIST = ["#FC4603", "#1BA672", "#F59E0B", "#7C3AED", "#3B82F6", "#EC4899"];
const TYPES = [
  { value: "delivery_count",  label: "Delivery Count" },
  { value: "earnings_amount", label: "Earnings Amount" },
  { value: "zone_deliveries", label: "Zone Deliveries" },
];

type Tier = { target: number; reward_paise: number; label: string };
type FormState = {
  title: string; description: string; icon: string; color: string;
  type: string; tiers: Tier[]; windowType: string;
};
const EMPTY_FORM: FormState = {
  title: "", description: "", icon: "zap", color: "#FC4603",
  type: "delivery_count", tiers: [{ target: 0, reward_paise: 0, label: "" }],
  windowType: "daily",
};

const inp = "w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-colors";
const Lbl = ({ children }: { children: React.ReactNode }) => (
  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">{children}</label>
);

function TierRow({ tier, index, onChange, onRemove, isEarnings }: {
  tier: Tier; index: number; onChange: (t: Tier) => void; onRemove: () => void; isEarnings: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-black text-zinc-600 w-4 text-center">{index + 1}</span>
      <input
        className={inp + " flex-[1.5]"}
        placeholder={isEarnings ? "Target ₹" : "Target trips"}
        type="number" min="0"
        value={tier.target > 0 ? (isEarnings ? tier.target / 100 : tier.target) : ""}
        onChange={e => {
          const v = parseFloat(e.target.value) || 0;
          onChange({ ...tier, target: isEarnings ? Math.round(v * 100) : Math.round(v) });
        }}
      />
      <input
        className={inp + " flex-1"}
        placeholder="₹ Bonus"
        type="number" min="0"
        value={tier.reward_paise > 0 ? tier.reward_paise / 100 : ""}
        onChange={e => onChange({ ...tier, reward_paise: Math.round((parseFloat(e.target.value) || 0) * 100) })}
      />
      <input
        className={inp + " flex-[1.5]"}
        placeholder="Label"
        value={tier.label}
        onChange={e => onChange({ ...tier, label: e.target.value })}
      />
      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-400 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MissionModal({ initial, onClose, onSave, isSaving }: {
  initial: FormState | null; onClose: () => void;
  onSave: (f: FormState) => void; isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial || EMPTY_FORM);
  useEffect(() => { setForm(initial || EMPTY_FORM); }, [initial]);

  const set = (key: keyof FormState, val: any) => setForm(f => ({ ...f, [key]: val }));
  const isEarnings = form.type === "earnings_amount";

  const updateTier = (i: number, tier: Tier) => {
    const next = [...form.tiers]; next[i] = tier; set("tiers", next);
  };
  const removeTier = (i: number) => {
    if (form.tiers.length === 1) return;
    set("tiers", form.tiers.filter((_, idx) => idx !== i));
  };

  const submit = () => {
    if (!form.title.trim()) return toast.error("Enter a mission title");
    if (form.tiers.some(t => t.target <= 0 || t.reward_paise <= 0 || !t.label.trim()))
      return toast.error("Fill all tier fields");
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h2 className="text-base font-black text-white">{initial?.title ? "Edit Mission" : "New Mission"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          <div>
            <Lbl>Title</Lbl>
            <input className={inp} placeholder="Mission title" value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div>
            <Lbl>Description</Lbl>
            <input className={inp} placeholder="Short description" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div>
            <Lbl>Type</Lbl>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(tp => (
                <button
                  key={tp.value}
                  onClick={() => set("type", tp.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    form.type === tp.value
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >{tp.label}</button>
              ))}
            </div>
          </div>

          <div>
            <Lbl>Window</Lbl>
            <div className="flex gap-2">
              {(["daily", "weekly"] as const).map(w => (
                <button
                  key={w}
                  onClick={() => set("windowType", w)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    form.windowType === w
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >{w === "daily" ? "Daily" : "Weekly"}</button>
              ))}
            </div>
          </div>

          <div>
            <Lbl>Icon</Lbl>
            <div className="flex gap-2">
              {ICONS_LIST.map(ic => {
                const Ic = ICON_COMPS[ic];
                const active = form.icon === ic;
                return (
                  <button
                    key={ic}
                    onClick={() => set("icon", ic)}
                    style={active ? { borderColor: form.color, backgroundColor: form.color + "22" } : {}}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                      active ? "" : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <Ic className="w-4 h-4" style={{ color: active ? form.color : "#6b7280" }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Lbl>Color</Lbl>
            <div className="flex gap-2">
              {COLORS_LIST.map(c => (
                <button
                  key={c}
                  onClick={() => set("color", c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition-all ${
                    form.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0f0f1a]" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Lbl>Tiers</Lbl>
              <button
                onClick={() => set("tiers", [...form.tiers, { target: 0, reward_paise: 0, label: "" }])}
                className="flex items-center gap-1 text-orange-400 text-xs font-bold hover:text-orange-300 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Tier
              </button>
            </div>
            <p className="text-xs text-zinc-600 mb-3">
              {isEarnings ? "Target in ₹" : "Target in trip count"} · Bonus in ₹ · Label shown on card
            </p>
            {form.tiers.map((tier, i) => (
              <TierRow
                key={i} tier={tier} index={i} isEarnings={isEarnings}
                onChange={v => updateTier(i, v)}
                onRemove={() => removeTier(i)}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-400 font-bold text-sm hover:border-white/20 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black text-sm hover:bg-orange-400 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving…" : "Save Mission"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionsTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; form: FormState } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get("/missions/templates");
      setTemplates(data.templates || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load missions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (tpl: any) => {
    setEditTarget({
      id: tpl.id,
      form: {
        title: tpl.title, description: tpl.description, icon: tpl.icon,
        color: tpl.color, type: tpl.type, tiers: tpl.tiers, windowType: tpl.window_type,
      },
    });
    setModalOpen(true);
  };

  const handleSave = async (f: FormState) => {
    setIsSaving(true);
    try {
      const payload = {
        title: f.title, description: f.description, icon: f.icon,
        color: f.color, type: f.type, tiers: f.tiers, windowType: f.windowType,
      };
      if (editTarget) {
        await api.patch(`/missions/templates/${editTarget.id}`, payload);
        toast.success("Mission updated");
      } else {
        await api.post("/missions/templates", payload);
        toast.success("Mission created");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (tpl: any) => {
    try {
      await api.patch(`/missions/templates/${tpl.id}/toggle`, {});
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, is_active: !t.is_active } : t));
    } catch (e: any) {
      toast.error(e.message || "Toggle failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/missions/templates/${id}`);
      toast.success("Mission deleted");
      setConfirmId(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  };

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Mission Builder</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {templates.length} mission{templates.length !== 1 ? "s" : ""} configured · Auto-assigned to all riders every midnight
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New Mission
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div
          onClick={openNew}
          className="border-2 border-dashed border-orange-500/30 rounded-2xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-orange-500/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
            <Zap className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-white font-black text-lg">Create your first mission</p>
          <p className="text-zinc-500 text-sm text-center max-w-sm">
            Set up delivery count, earnings, or zone-based missions with tiered rewards for your riders.
          </p>
        </div>
      )}

      {/* Template cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map(tpl => {
          const Ic = ICON_COMPS[tpl.icon] || Zap;
          const tiers: Tier[] = tpl.tiers || [];
          const totalBonus = tiers.reduce((s, t) => s + t.reward_paise, 0);
          return (
            <div
              key={tpl.id}
              className={`bg-[#0f0f1a] border rounded-2xl p-5 flex flex-col gap-4 transition-opacity ${
                tpl.is_active ? "border-white/[0.07]" : "border-white/[0.03] opacity-50"
              }`}
            >
              {/* Top row */}
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: tpl.color + "22" }}
                >
                  <Ic className="w-5 h-5" style={{ color: tpl.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm leading-tight">{tpl.title}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {tpl.window_type === "daily" ? "Daily" : "Weekly"} ·{" "}
                    {TYPES.find(t => t.value === tpl.type)?.label} ·{" "}
                    {tiers.length} tier{tiers.length !== 1 ? "s" : ""} · +₹{(totalBonus / 100).toFixed(0)} max
                  </p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(tpl)}
                  className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${
                    tpl.is_active ? "bg-orange-500" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      tpl.is_active ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Stats row */}
              <div className="flex gap-4 text-xs border-t border-white/[0.07] pt-3">
                <span className="text-zinc-400">🏃 {tpl.today_riders ?? 0} active today</span>
                <span className="text-zinc-400">✓ {tpl.today_completed ?? 0} completed</span>
              </div>

              {/* Tiers preview */}
              {tiers.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {tiers.map((tier, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: tpl.color + "18", color: tpl.color }}
                    >
                      {tier.label} · ₹{(tier.reward_paise / 100).toFixed(0)}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-0">
                <button
                  onClick={() => openEdit(tpl)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => setConfirmId(tpl.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <MissionModal
          initial={editTarget?.form ?? null}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmId}
        title="Delete Mission"
        message="This will remove the mission template and all rider progress. Are you sure?"
        confirmText="Delete"
        isDanger
        onConfirm={() => confirmId && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
