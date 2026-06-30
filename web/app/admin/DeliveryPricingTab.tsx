"use client";

import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { DollarSign, Percent, Bike, MapPin, Plus, Trash2, ChevronRight } from "lucide-react";

export function DeliveryPricingTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Tiers state per zone
  const [tiers, setTiers] = useState<Record<string, any[]>>({});
  const [tierForm, setTierForm] = useState<Record<string, { from: string; to: string; fee: string }>>({});

  const load = async () => {
    try {
      const data = await api.get("/admin/zones");
      setZones(data.zones ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useSocketRefresh(["zone_updated"], load);

  const loadTiers = async (zoneId: string) => {
    try {
      const data = await api.get(`/admin/zones/${zoneId}/delivery-tiers`);
      setTiers(prev => ({ ...prev, [zoneId]: data.tiers ?? [] }));
    } catch { /* silently skip */ }
  };

  const startEdit = (zone: any) => {
    setEditing(zone.id);
    setForm({
      delivery_fee_type: zone.delivery_fee_type || "flat",
      base_delivery_fee_paise: zone.base_delivery_fee_paise || zone.delivery_fee_base_paise || "",
      per_km_fee_paise: zone.per_km_fee_paise || "",
      base_distance_km: zone.base_distance_km || "",
      free_delivery_above_paise: zone.free_delivery_above_paise ?? "",
      surge_multiplier: zone.surge_multiplier || "1.0",
      surge_enabled: zone.surge_enabled,
      min_order_paise: zone.min_order_paise ?? "",
      small_order_fee_paise: zone.small_order_fee_paise ?? "",
    });
    loadTiers(zone.id);
  };

  const save = async (id: string, zone: any) => {
    setSaving(true);
    try {
      await api.patch(`/admin/zones/${id}`, {
        ...zone,
        delivery_fee_type: form.delivery_fee_type || "flat",
        base_delivery_fee_paise: parseInt(form.base_delivery_fee_paise || "0", 10),
        delivery_fee_base_paise: parseInt(form.base_delivery_fee_paise || "0", 10),
        per_km_fee_paise: parseInt(form.per_km_fee_paise || "0", 10),
        base_distance_km: parseFloat(form.base_distance_km || "0"),
        free_delivery_above_paise: form.free_delivery_above_paise !== "" ? parseInt(form.free_delivery_above_paise, 10) : null,
        surge_multiplier: parseFloat(form.surge_multiplier || "1.0"),
        surge_enabled: form.surge_enabled,
        min_order_paise: form.min_order_paise !== "" ? parseInt(form.min_order_paise, 10) : 0,
        small_order_fee_paise: form.small_order_fee_paise !== "" ? parseInt(form.small_order_fee_paise, 10) : 0,
      });
      setEditing(null);
      load();
      toast.success("Pricing updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update pricing");
    } finally {
      setSaving(false);
    }
  };

  const addTier = async (zoneId: string) => {
    const tf = tierForm[zoneId] || { from: "", to: "", fee: "" };
    if (!tf.from || !tf.fee) { toast.error("From (paise) and Fee (paise) are required"); return; }
    try {
      await api.post(`/admin/zones/${zoneId}/delivery-tiers`, {
        from_paise: parseInt(tf.from, 10),
        to_paise: tf.to ? parseInt(tf.to, 10) : null,
        fee_paise: parseInt(tf.fee, 10),
      });
      setTierForm(prev => ({ ...prev, [zoneId]: { from: "", to: "", fee: "" } }));
      loadTiers(zoneId);
      toast.success("Tier added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add tier");
    }
  };

  const deleteTier = async (zoneId: string, tierId: string) => {
    try {
      await api.delete(`/admin/zones/${zoneId}/delivery-tiers/${tierId}`);
      loadTiers(zoneId);
      toast.success("Tier removed");
    } catch {
      toast.error("Failed to remove tier");
    }
  };

  const field = (label: string, key: string, type = "text", placeholder = "") => (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      {type === "checkbox" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })}
            className="w-4 h-4 accent-brand-primary rounded" />
          <span className="text-xs font-semibold text-white">{form[key] ? "Enabled" : "Disabled"}</span>
        </label>
      ) : type === "select" ? (
        <select value={form[key] ?? "flat"} onChange={e => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50">
          <option value="flat">Flat Fee</option>
          <option value="per_km">Per KM Based</option>
        </select>
      ) : (
        <input type={type} placeholder={placeholder} value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50" />
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Delivery Pricing</h2>
          <p className="text-zinc-400 text-sm font-medium">Flat / per-km fees, surge, minimum order, small order fee, and delivery fee tiers per zone.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-white/[0.04] rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {zones.map(zone => {
            const zoneTiers = tiers[zone.id] ?? [];
            const tf = tierForm[zone.id] || { from: "", to: "", fee: "" };
            const isEditing = editing === zone.id;

            return (
              <div key={zone.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
                {/* Zone header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                      <div className="font-black text-white text-lg">{zone.name}</div>
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{zone.city}</div>
                    </div>
                  </div>
                  {!isEditing ? (
                    <button onClick={() => startEdit(zone)}
                      className="px-4 py-2 rounded-xl bg-brand-primary/15 text-brand-primary text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/25 transition-all">
                      Edit Pricing
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(null)}
                        className="px-3 py-2 rounded-xl bg-white/[0.05] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10">Cancel</button>
                      <button onClick={() => save(zone.id, zone)} disabled={saving}
                        className="px-4 py-2 rounded-xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-dark shadow-lg shadow-brand-primary/30 disabled:opacity-60">
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="p-5 space-y-6 bg-white/[0.02]">
                    {/* ── Base fee config ── */}
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Base Delivery Fee</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {field("Fee Type", "delivery_fee_type", "select")}
                        {form.delivery_fee_type === "per_km" ? (
                          <>
                            {field("Base Fee (paise)", "base_delivery_fee_paise", "number")}
                            {field("Per KM Rate (paise)", "per_km_fee_paise", "number")}
                            {field("Base Distance (KM)", "base_distance_km", "number")}
                          </>
                        ) : (
                          field("Flat Fee (paise)", "base_delivery_fee_paise", "number")
                        )}
                        {field("Free Delivery Above (paise)", "free_delivery_above_paise", "number", "e.g. 30000")}
                        {field("Surge Multiplier", "surge_multiplier", "number", "1.0")}
                        {field("Surge Enabled", "surge_enabled", "checkbox")}
                      </div>
                    </div>

                    <div className="border-t border-white/5" />

                    {/* ── Minimum order + small order fee ── */}
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Minimum Order & Small Order Fee</div>
                      <div className="grid grid-cols-2 gap-4">
                        {field("Minimum Order (paise)", "min_order_paise", "number", "e.g. 15000 = ₹150 min")}
                        {field("Small Order Fee (paise)", "small_order_fee_paise", "number", "e.g. 2500 = ₹25 fee")}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-2">
                        If min_order &gt; 0: orders below it are blocked (hard minimum). If min_order = 0 and small_order_fee &gt; 0: orders without a minimum still pay the fee.
                      </p>
                    </div>

                    <div className="border-t border-white/5" />

                    {/* ── Delivery fee tiers ── */}
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                        Delivery Fee Tiers <span className="normal-case text-zinc-600 ml-2">(overrides flat/per_km when matched)</span>
                      </div>

                      {zoneTiers.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {zoneTiers.map(t => (
                            <div key={t.id} className="flex items-center justify-between bg-black/20 px-4 py-3 rounded-xl border border-white/5">
                              <div className="flex items-center gap-3 text-sm font-bold text-white">
                                <span className="text-zinc-400">₹{t.from_paise / 100}</span>
                                <ChevronRight className="w-3 h-3 text-zinc-600" />
                                <span className="text-zinc-400">{t.to_paise != null ? `₹${t.to_paise / 100}` : "∞"}</span>
                                <span className="w-px h-4 bg-white/10" />
                                <span className="text-emerald-400">₹{t.fee_paise / 100} delivery</span>
                              </div>
                              <button onClick={() => deleteTier(zone.id, t.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add tier row */}
                      <div className="flex items-end gap-3">
                        {[
                          { placeholder: "From ₹ (paise)", key: "from" },
                          { placeholder: "To ₹ (paise, blank = ∞)", key: "to" },
                          { placeholder: "Fee (paise)", key: "fee" },
                        ].map(({ placeholder, key }) => (
                          <div key={key} className="flex-1">
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                              {placeholder.split(" ")[0]} {placeholder.split(" ")[1]}
                            </div>
                            <input
                              type="number"
                              placeholder={placeholder}
                              value={(tf as any)[key]}
                              onChange={e => setTierForm(prev => ({ ...prev, [zone.id]: { ...tf, [key]: e.target.value } }))}
                              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50"
                            />
                          </div>
                        ))}
                        <button onClick={() => addTier(zone.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary/15 text-brand-primary text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all shrink-0">
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-2">
                        Example: ₹0–₹149 → ₹45 · ₹150–₹299 → ₹25 · ₹300+ → ₹0 (free). Set in paise (×100).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Type", value: zone.delivery_fee_type === "per_km" ? "Per KM" : "Flat", icon: Bike },
                      { label: "Base Fee", value: `₹${((zone.base_delivery_fee_paise || zone.delivery_fee_base_paise) ?? 0) / 100}`, icon: DollarSign },
                      { label: "Free Above", value: zone.free_delivery_above_paise ? `₹${zone.free_delivery_above_paise / 100}` : "—", icon: DollarSign },
                      { label: "Surge", value: `${zone.surge_multiplier || 1.0}x`, icon: Percent },
                      { label: "Min Order", value: zone.min_order_paise ? `₹${zone.min_order_paise / 100}` : "None", icon: DollarSign },
                      { label: "Small Order Fee", value: zone.small_order_fee_paise ? `₹${zone.small_order_fee_paise / 100}` : "None", icon: DollarSign },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">{label}</div>
                          <div className="font-bold text-white text-sm">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
