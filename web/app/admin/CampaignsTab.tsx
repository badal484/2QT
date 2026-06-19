"use client";
import { useState } from "react";
import { Zap, Clock, Gift, RotateCcw, Cake, TrendingUp, Star, ToggleLeft, ToggleRight, Edit3, X, Check, Loader2, Plus } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

        <button
          onClick={() => setEditing(true)}
          className="mt-4 flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <Edit3 size={12}/> Edit settings
        </button>
      </div>
    </>
  );
}

export function CampaignsTab() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => api.get("/campaigns"),
  });

  const campaigns: Campaign[] = data?.campaigns ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">Campaigns & Offers</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Toggle any offer on or off. <strong>Users stop seeing disabled offers within 30 seconds</strong> — no cache stale issues.
        </p>
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
            <CampaignCard key={c.id} campaign={c} onRefresh={() => refetch()}/>
          ))}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <Zap size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="font-semibold">No campaigns yet.</p>
          <p className="text-sm mt-1">Run migration 049 in Supabase to seed the default campaigns.</p>
        </div>
      )}
    </div>
  );
}
