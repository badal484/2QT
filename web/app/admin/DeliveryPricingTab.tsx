"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { DollarSign, Bike, MapPin, Plus, Trash2, ChevronRight, Calculator, Zap, Globe } from "lucide-react";
import { useAdminZone } from "./AdminZoneContext";

export function DeliveryPricingTab() {
  const { selectedZoneId, selectedZone: globalActiveZone } = useAdminZone();
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Tiers state per zone
  const [tiers, setTiers] = useState<Record<string, any[]>>({});
  const [tierForm, setTierForm] = useState<Record<string, { from: string; to: string; fee: string }>>({});

  const visibleZones = useMemo(() => {
    if (selectedZoneId === "ALL") return zones;
    const filtered = zones.filter(z => z.id === selectedZoneId);
    return filtered.length > 0 ? filtered : zones;
  }, [zones, selectedZoneId]);

  // Live fee calculator
  const [calcCart, setCalcCart] = useState("200");
  const [calcDist, setCalcDist] = useState("3");

  const previewFee = (zone: any, zoneTiers: any[]) => {
    const cartPaise = Math.round(parseFloat(calcCart || "0") * 100);
    const distKm = parseFloat(calcDist || "0");
    const surgeMultiplier = parseFloat(zone.surge_multiplier || "1") || 1;
    const surgeOn = zone.surge_enabled
      && surgeMultiplier > 1
      && (!zone.surge_expires_at || new Date(zone.surge_expires_at) > new Date());

    // Tier match
    const tier = zoneTiers.find(t => t.from_paise <= cartPaise && (t.to_paise == null || t.to_paise > cartPaise));
    let base = 0;
    if (tier) {
      base = tier.fee_paise;
    } else if (zone.delivery_fee_type === "per_km") {
      const baseKm = parseFloat(zone.base_distance_km || "0");
      const extraKm = Math.max(0, distKm - baseKm);
      base = (zone.base_delivery_fee_paise || 0) + Math.ceil(extraKm * 10) / 10 * (zone.per_km_fee_paise || 0);
    } else {
      base = zone.base_delivery_fee_paise || 0;
    }

    if (zone.free_delivery_above_paise != null && cartPaise >= zone.free_delivery_above_paise) base = 0;
    const surge = surgeOn ? Math.floor(base * surgeMultiplier) - base : 0;
    return { base, surge, total: base + surge };
  };

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
      surge_duration_hours: "",
      min_order_paise: zone.min_order_paise ?? "",
      small_order_fee_paise: zone.small_order_fee_paise ?? "",
      rider_base_pay_paise: zone.rider_base_pay_paise ?? 2000,
      rider_per_km_paise: zone.rider_per_km_paise ?? 500,
      rider_free_km: zone.rider_free_km ?? 2.0,
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
        surge_expires_at: form.surge_enabled && form.surge_duration_hours
          ? new Date(Date.now() + parseFloat(form.surge_duration_hours) * 3600 * 1000).toISOString()
          : undefined,
        min_order_paise: form.min_order_paise !== "" ? parseInt(form.min_order_paise, 10) : 0,
        small_order_fee_paise: form.small_order_fee_paise !== "" ? parseInt(form.small_order_fee_paise, 10) : 0,
        rider_base_pay_paise: parseInt(form.rider_base_pay_paise || "2000", 10),
        rider_per_km_paise: parseInt(form.rider_per_km_paise || "500", 10),
        rider_free_km: parseFloat(form.rider_free_km || "2.0"),
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
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-4xl font-black tracking-tighter text-white">Delivery Pricing</h2>
            {selectedZoneId !== "ALL" && globalActiveZone && (
              <span className="px-2.5 py-1 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30 text-xs font-black uppercase">
                📍 {globalActiveZone.name}
              </span>
            )}
          </div>
          <p className="text-zinc-400 text-sm font-medium">
            {selectedZoneId === "ALL"
              ? "Flat / per-km fees, surge, minimum order, small order fee, and delivery fee tiers across all zones."
              : `Configuring delivery fee slabs, surge rates, and minimum order rules for ${globalActiveZone?.name || 'this zone'}.`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-white/[0.04] rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {visibleZones.map(zone => {
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
                        {form.surge_enabled && (
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Surge Duration</div>
                            <select
                              value={form.surge_duration_hours}
                              onChange={e => setForm({ ...form, surge_duration_hours: e.target.value })}
                              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50"
                            >
                              <option value="">No expiry</option>
                              <option value="1">1 hour</option>
                              <option value="2">2 hours</option>
                              <option value="4">4 hours</option>
                              <option value="6">6 hours</option>
                              <option value="12">12 hours</option>
                              <option value="24">24 hours</option>
                            </select>
                            <p className="text-[10px] text-zinc-500 mt-1">Surge auto-expires after this duration.</p>
                          </div>
                        )}
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

                    {/* ── Rider Earnings ── */}
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Rider Earnings</div>
                      <div className="grid grid-cols-3 gap-4">
                        {field("Short-trip Flat Pay (paise)", "rider_base_pay_paise", "number", "e.g. 1500 = ₹15")}
                        {field("Per KM Rate (paise)", "rider_per_km_paise", "number", "e.g. 800 = ₹8/km")}
                        {field("Short-trip Threshold (km)", "rider_free_km", "number", "e.g. 1.0")}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-2">
                        ≤ threshold km → flat pay. &gt; threshold km → per-km rate × full distance. Surge multiplier applied on top. 10% platform fee deducted.
                        Example: threshold 1km, flat ₹15, per-km ₹8 → 1km = ₹15, 3km = ₹24.
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
                  <div className="p-5 space-y-5">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Type", value: zone.delivery_fee_type === "per_km" ? "Per KM" : "Flat", icon: Bike },
                        { label: "Base Fee", value: `₹${((zone.base_delivery_fee_paise || zone.delivery_fee_base_paise) ?? 0) / 100}`, icon: DollarSign },
                        { label: "Free Above", value: zone.free_delivery_above_paise ? `₹${zone.free_delivery_above_paise / 100}` : "—", icon: DollarSign },
                        {
                          label: "Surge",
                          value: zone.surge_enabled
                            ? `${zone.surge_multiplier || 1.0}x${zone.surge_expires_at ? ` until ${new Date(zone.surge_expires_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}` : " (no expiry)"}`
                            : "Off",
                          icon: Zap,
                        },
                        { label: "Min Order", value: zone.min_order_paise ? `₹${zone.min_order_paise / 100}` : "None", icon: DollarSign },
                        { label: "Small Order Fee", value: zone.small_order_fee_paise ? `₹${zone.small_order_fee_paise / 100}` : "None", icon: DollarSign },
                        { label: "Short-trip Pay", value: `₹${(zone.rider_base_pay_paise ?? 2000) / 100} (≤${zone.rider_free_km ?? 2}km)`, icon: Bike },
                        { label: "Rider /km", value: `₹${(zone.rider_per_km_paise ?? 500) / 100}/km (full dist)`, icon: Bike },
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

                    {/* Live fee calculator */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-brand-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fee Preview Calculator</span>
                      </div>
                      <div className="flex items-end gap-3 flex-wrap">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Cart Value (₹)</div>
                          <input
                            type="number"
                            value={calcCart}
                            onChange={e => setCalcCart(e.target.value)}
                            className="w-28 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50"
                          />
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Distance (km)</div>
                          <input
                            type="number"
                            value={calcDist}
                            onChange={e => setCalcDist(e.target.value)}
                            className="w-28 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50"
                          />
                        </div>
                        {(() => {
                          const { base, surge, total } = previewFee(zone, tiers[zone.id] ?? []);
                          return (
                            <div className="flex items-center gap-3 ml-2">
                              <div className="text-center">
                                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Base Fee</div>
                                <div className="text-lg font-black text-white">₹{(base / 100).toFixed(0)}</div>
                              </div>
                              {surge > 0 && (
                                <>
                                  <span className="text-zinc-600 font-bold">+</span>
                                  <div className="text-center">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Surge</div>
                                    <div className="text-lg font-black text-amber-400">₹{(surge / 100).toFixed(0)}</div>
                                  </div>
                                </>
                              )}
                              <span className="text-zinc-600 font-bold">=</span>
                              <div className="text-center bg-brand-primary/10 border border-brand-primary/20 rounded-xl px-4 py-2">
                                <div className="text-[9px] font-black uppercase tracking-widest text-brand-primary mb-1">Customer Pays</div>
                                <div className="text-xl font-black text-brand-primary">₹{(total / 100).toFixed(0)}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
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
