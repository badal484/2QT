"use client";
import { useState, useEffect, useCallback } from "react";
import { Zap, Clock, Gift, RotateCcw, Cake, TrendingUp, Star, ToggleLeft, ToggleRight, Edit3, X, Check, Loader2, Plus } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const TYPE_META: Record<string, { label: string; color: string; icon: any; desc: string }> = {
  welcome:      { label: "Welcome",      color: "orange", icon: Gift,       desc: "First-time user discount" },
  winback:      { label: "Win-back",     color: "purple", icon: RotateCcw,  desc: "Re-engage inactive customers" },
  birthday:     { label: "Birthday",     color: "pink",   icon: Cake,       desc: "Auto birthday reward" },
  flash_sale:   { label: "Flash Sale",   color: "red",    icon: Zap,        desc: "Limited-time manual sale" },
  happy_hour:   { label: "Happy Hour",   color: "amber",  icon: Clock,      desc: "Time-based free delivery" },
  streak:       { label: "Streaks",      color: "green",  icon: TrendingUp, desc: "Daily ordering rewards" },
  milestone:    { label: "Milestones",   color: "blue",   icon: Star,       desc: "Order count rewards" },
  plus_exclusive:{ label: "2QT Plus",   color: "indigo", icon: Star,       desc: "Subscriber-only perks" },
};

const COLOR_MAP: Record<string, string> = {
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
  pink:   "bg-pink-100 text-pink-700",
  red:    "bg-red-100 text-red-700",
  amber:  "bg-amber-100 text-amber-700",
  green:  "bg-green-100 text-green-700",
  blue:   "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

const SEGMENT_OPTIONS = [
  { value: "", label: "All customers" },
  { value: "new_users", label: "New users (joined <7d)" },
  { value: "active", label: "Active (ordered in 14d)" },
  { value: "at_risk", label: "At risk (7–14d inactive)" },
  { value: "churned", label: "Churned (30d+ inactive)" },
  { value: "loyal", label: "Loyal (10+ orders)" },
  { value: "subscribers", label: "Subscribers" },
];

interface Campaign {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  discount_type: string;
  discount_percent: number;
  discount_flat_paise: number;
  max_discount_paise: number | null;
  min_order_paise: number;
  winback_days: number | null;
  flash_start: string | null;
  flash_end: string | null;
  happy_hour_start: string | null;
  happy_hour_end: string | null;
  happy_hour_days: string[] | null;
  config: any;
  // Audience
  audience_type: string | null;
  audience_segment: string | null;
  // Schedule
  schedule_start: string | null;
  schedule_end: string | null;
  // Notification
  notif_template_type: string | null;
  notif_sent_at: string | null;
  // Results
  reach_count: number;
  conversion_count: number;
}

function discountLabel(c: Campaign) {
  if (c.discount_type === "free_delivery") return "Free Delivery";
  if (c.discount_type === "flat") return `₹${((c.discount_flat_paise || 0) / 100).toFixed(0)} off`;
  if (c.discount_percent > 0) {
    const cap = c.max_discount_paise ? ` (max ₹${(c.max_discount_paise / 100).toFixed(0)})` : "";
    return `${c.discount_percent}% off${cap}`;
  }
  return "—";
}

function EditModal({ campaign, onClose, onSaved }: { campaign: Campaign; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: campaign.name,
    discount_type: campaign.discount_type,
    discount_percent: campaign.discount_percent,
    discount_flat_paise: campaign.discount_flat_paise || 0,
    max_discount_paise: campaign.max_discount_paise || 0,
    min_order_paise: campaign.min_order_paise || 0,
    winback_days: campaign.winback_days || 7,
    flash_start: campaign.flash_start ? campaign.flash_start.slice(0,16) : "",
    flash_end: campaign.flash_end ? campaign.flash_end.slice(0,16) : "",
    happy_hour_start: campaign.happy_hour_start || "15:00",
    happy_hour_end: campaign.happy_hour_end || "18:00",
    // Audience
    audience_segment: campaign.audience_segment ?? "",
    // Schedule
    schedule_start: campaign.schedule_start ? campaign.schedule_start.slice(0,16) : "",
    schedule_end: campaign.schedule_end ? campaign.schedule_end.slice(0,16) : "",
    // Notification
    notif_template_type: campaign.notif_template_type ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/campaigns/${campaign.id}`, {
        ...form,
        discount_percent: Number(form.discount_percent),
        discount_flat_paise: Number(form.discount_flat_paise),
        max_discount_paise: Number(form.max_discount_paise) || null,
        min_order_paise: Number(form.min_order_paise),
        winback_days: Number(form.winback_days),
        flash_start: form.flash_start || null,
        flash_end: form.flash_end || null,
        audience_type: form.audience_segment ? "segment" : "all",
        audience_segment: form.audience_segment || null,
        schedule_start: form.schedule_start || null,
        schedule_end: form.schedule_end || null,
        notif_template_type: form.notif_template_type || null,
      });
      toast.success("Campaign saved — users see updated offer within 30 seconds");
      onSaved();
      onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const f = (key: string, label: string, type = "number", placeholder = "") => (
    <div>
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
        value={(form as any)[key]}
        placeholder={placeholder}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">Edit — {campaign.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100"><X size={18}/></button>
        </div>

        {f("name", "Campaign name", "text")}

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Discount type</label>
          <select
            className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
            value={form.discount_type}
            onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}
          >
            <option value="percentage">Percentage %</option>
            <option value="flat">Flat ₹ amount</option>
            <option value="free_delivery">Free Delivery</option>
          </select>
        </div>

        {form.discount_type === "percentage" && f("discount_percent", "Discount %")}
        {form.discount_type === "flat" && f("discount_flat_paise", "Flat discount (paise)", "number", "e.g. 3000 = ₹30")}
        {f("max_discount_paise", "Max discount cap (paise, 0 = no cap)", "number", "e.g. 6000 = ₹60")}
        {f("min_order_paise", "Min order value (paise)", "number", "e.g. 10000 = ₹100")}

        {campaign.type === "winback" && f("winback_days", "Inactive days before trigger")}
        {campaign.type === "flash_sale" && (
          <>
            {f("flash_start", "Flash sale start", "datetime-local")}
            {f("flash_end", "Flash sale end", "datetime-local")}
          </>
        )}
        {campaign.type === "happy_hour" && (
          <div className="grid grid-cols-2 gap-3">
            {f("happy_hour_start", "Start time", "time")}
            {f("happy_hour_end", "End time", "time")}
          </div>
        )}

        {/* ── Audience ── */}
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Audience</p>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Target segment</label>
            <select
              className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
              value={form.audience_segment}
              onChange={e => setForm(p => ({ ...p, audience_segment: e.target.value }))}
            >
              {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Schedule ── */}
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Schedule (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            {f("schedule_start", "Goes live at", "datetime-local")}
            {f("schedule_end", "Expires at", "datetime-local")}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Leave blank to manage manually via the ON/OFF toggle.</p>
        </div>

        {/* ── Notification ── */}
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Notification (optional)</p>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Send template when campaign goes live</label>
            <input
              type="text"
              className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
              placeholder="e.g. broadcast_message (leave blank to skip)"
              value={form.notif_template_type}
              onChange={e => setForm(p => ({ ...p, notif_template_type: e.target.value }))}
            />
            {campaign.notif_sent_at && (
              <p className="text-[11px] text-green-600 mt-1">
                ✓ Notification sent {new Date(campaign.notif_sent_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-400 bg-zinc-50 rounded-xl p-3">
          Changes go live instantly. When you disable a campaign, users stop seeing it within <strong>30 seconds</strong>.
        </p>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold hover:bg-zinc-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const meta = TYPE_META[campaign.type] ?? { label: campaign.type, color: "zinc", icon: Zap, desc: "" };
  const Icon = meta.icon;

  const toggle = async () => {
    setToggling(true);
    try {
      await api.patch(`/campaigns/${campaign.id}`, { is_active: !campaign.is_active });
      toast.success(campaign.is_active
        ? "Campaign disabled — removed from app within 30 seconds"
        : "Campaign enabled — live in app within 30 seconds"
      );
      onRefresh();
    } catch { toast.error("Failed to toggle"); }
    setToggling(false);
  };

  return (
    <>
      {editing && <EditModal campaign={campaign} onClose={() => setEditing(false)} onSaved={onRefresh}/>}
      <div className={`bg-white rounded-2xl border-2 p-5 transition-all ${campaign.is_active ? "border-zinc-100 shadow-sm" : "border-zinc-100 opacity-60"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${COLOR_MAP[meta.color]}`}>
              <Icon size={20}/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm">{campaign.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COLOR_MAP[meta.color]}`}>{meta.label}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{meta.desc}</p>
            </div>
          </div>

          {/* ON/OFF Toggle */}
          <button
            onClick={toggle}
            disabled={toggling}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              campaign.is_active
                ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-green-100 hover:text-green-700"
            }`}
          >
            {toggling
              ? <Loader2 size={14} className="animate-spin"/>
              : campaign.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>
            }
            {campaign.is_active ? "ON" : "OFF"}
          </button>
        </div>

        {/* Key info */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="bg-zinc-50 text-zinc-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
            {discountLabel(campaign)}
          </span>
          {campaign.min_order_paise > 0 && (
            <span className="bg-zinc-50 text-zinc-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
              Min ₹{(campaign.min_order_paise / 100).toFixed(0)}
            </span>
          )}
          {campaign.type === "winback" && campaign.winback_days && (
            <span className="bg-zinc-50 text-zinc-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
              Trigger: {campaign.winback_days} days inactive
            </span>
          )}
          {campaign.type === "happy_hour" && campaign.happy_hour_start && (
            <span className="bg-zinc-50 text-zinc-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
              {campaign.happy_hour_start} – {campaign.happy_hour_end}
            </span>
          )}
          {campaign.type === "flash_sale" && campaign.flash_start && (
            <span className="bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
              {new Date(campaign.flash_start).toLocaleString("en-IN")} →  {new Date(campaign.flash_end!).toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* Results + audience + schedule chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {campaign.audience_segment && (
            <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-lg">
              {SEGMENT_OPTIONS.find(s => s.value === campaign.audience_segment)?.label ?? campaign.audience_segment}
            </span>
          )}
          {campaign.schedule_start && (
            <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-lg">
              From {new Date(campaign.schedule_start).toLocaleDateString("en-IN")}
            </span>
          )}
          {campaign.schedule_end && (
            <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-lg">
              Until {new Date(campaign.schedule_end).toLocaleDateString("en-IN")}
            </span>
          )}
          {(campaign.reach_count > 0 || campaign.conversion_count > 0) && (
            <span className="bg-zinc-50 text-zinc-600 text-xs font-semibold px-2 py-0.5 rounded-lg">
              {campaign.reach_count} reached · {campaign.conversion_count} converted
              {campaign.reach_count > 0 && (
                <span className="text-green-600 ml-1">({Math.round((campaign.conversion_count / campaign.reach_count) * 100)}%)</span>
              )}
            </span>
          )}
        </div>

        <button
          onClick={() => setEditing(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <Edit3 size={12}/> Edit settings
        </button>
      </div>
    </>
  );
}

const EMPTY_CAMPAIGN = {
  name: "",
  type: "flash_sale",
  discount_type: "percentage",
  discount_percent: "0",
  discount_flat_paise: "0",
  max_discount_paise: "",
  min_order_paise: "0",
  winback_days: "7",
  flash_start: "",
  flash_end: "",
  happy_hour_start: "",
  happy_hour_end: "",
  happy_hour_days: "mon,tue,wed,thu,fri,sat,sun",
  zone_id: "",
  audience_segment: "",
  schedule_start: "",
  schedule_end: "",
};

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_CAMPAIGN });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await api.post("/campaigns", {
        ...form,
        discount_percent: Number(form.discount_percent),
        discount_flat_paise: Number(form.discount_flat_paise),
        max_discount_paise: Number(form.max_discount_paise) || null,
        min_order_paise: Number(form.min_order_paise),
        winback_days: Number(form.winback_days),
        flash_start: form.flash_start || null,
        flash_end: form.flash_end || null,
        happy_hour_start: form.happy_hour_start || null,
        happy_hour_end: form.happy_hour_end || null,
        happy_hour_days: form.happy_hour_days ? form.happy_hour_days.split(",").map(d => d.trim()) : null,
        zone_id: form.zone_id || null,
        audience_type: form.audience_segment ? "segment" : "all",
        audience_segment: form.audience_segment || null,
        schedule_start: form.schedule_start || null,
        schedule_end: form.schedule_end || null,
        is_active: false,
      });
      toast.success("Campaign created — toggle it on when ready");
      onCreated();
      onClose();
    } catch { toast.error("Failed to create campaign"); }
    setSaving(false);
  };

  const inp = (label: string, key: string, type = "text", placeholder = "") => (
    <div>
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
        value={(form as any)[key]}
        placeholder={placeholder}
        onChange={e => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">New Campaign</h3>
          <button onClick={onClose}><X size={18} className="text-zinc-400"/></button>
        </div>

        {inp("Campaign name *", "name", "text", "e.g. Weekend Flash Sale")}

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Type</label>
          <select className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
            value={form.type} onChange={e => set("type", e.target.value)}>
            {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label} — {m.desc}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Discount type</label>
          <select className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
            value={form.discount_type} onChange={e => set("discount_type", e.target.value)}>
            <option value="percentage">Percentage off subtotal</option>
            <option value="flat">Flat amount off</option>
            <option value="free_delivery">Free delivery</option>
          </select>
        </div>

        {form.discount_type === "percentage" && inp("Discount %", "discount_percent", "number", "10")}
        {form.discount_type === "flat" && inp("Flat discount (paise)", "discount_flat_paise", "number", "2000")}
        {inp("Max discount (paise, blank = no cap)", "max_discount_paise", "number", "5000")}
        {inp("Min order (paise)", "min_order_paise", "number", "0")}

        {form.type === "flash_sale" && <>
          {inp("Flash start", "flash_start", "datetime-local")}
          {inp("Flash end", "flash_end", "datetime-local")}
        </>}

        {form.type === "happy_hour" && <>
          {inp("Start time", "happy_hour_start", "time")}
          {inp("End time", "happy_hour_end", "time")}
          {inp("Days (comma-sep: mon,tue,...)", "happy_hour_days", "text", "mon,tue,wed,thu,fri,sat,sun")}
        </>}

        {form.type === "winback" && inp("Inactive days threshold", "winback_days", "number", "7")}

        {inp("Zone ID (blank = all zones)", "zone_id", "text")}

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Audience</label>
          <select className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
            value={form.audience_segment} onChange={e => set("audience_segment", e.target.value)}>
            {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-500 hover:bg-zinc-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get("/campaigns");
      setCampaigns(data?.campaigns ?? []);
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["campaign_updated"], load);

  return (
    <div className="space-y-6">
      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={load}/>}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black">Campaigns & Offers</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Toggle any offer on or off. <strong>Users stop seeing disabled offers within 30 seconds</strong> — no cache stale issues.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-black text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <Plus size={15}/> New Campaign
        </button>
      </div>

      {/* Status bar */}
      <div className="bg-black rounded-2xl p-4 text-white flex items-center justify-between">
        <div className="text-sm">
          <span className="font-black text-green-400">{campaigns.filter(c => c.is_active).length} active</span>
          <span className="text-zinc-400 ml-2">/ {campaigns.length} total campaigns</span>
        </div>
        <div className="text-xs text-zinc-400 bg-white/10 px-3 py-1.5 rounded-lg">
          30s cache · instant bust on toggle
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-zinc-300" size={28}/>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} onRefresh={load}/>
          ))}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <Zap size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="font-semibold">No campaigns yet.</p>
          <p className="text-sm mt-1">Click "New Campaign" to create your first one.</p>
        </div>
      )}
    </div>
  );
}
