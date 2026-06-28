"use client";

import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { DollarSign, Percent, Bike, MapPin } from "lucide-react";

export function DeliveryPricingTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

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

  const startEdit = (zone: any) => {
    setEditing(zone.id);
    setForm({
      delivery_fee_type: zone.delivery_fee_type || 'flat',
      base_delivery_fee_paise: zone.base_delivery_fee_paise || zone.delivery_fee_base_paise,
      per_km_fee_paise: zone.per_km_fee_paise || 500,
      base_distance_km: zone.base_distance_km || 0,
      free_delivery_above_paise: zone.free_delivery_above_paise,
      surge_multiplier: zone.surge_multiplier || 1.0,
      surge_enabled: zone.surge_enabled,
    });
  };

  const save = async (id: string, zone: any) => {
    setSaving(true);
    try {
      // Send the entire zone payload to avoid losing properties not present in this form.
      await api.patch(`/admin/zones/${id}`, {
        ...zone,
        delivery_fee_type: form.delivery_fee_type || 'flat',
        base_delivery_fee_paise: parseInt(form.base_delivery_fee_paise || "0", 10),
        delivery_fee_base_paise: parseInt(form.base_delivery_fee_paise || "0", 10),
        per_km_fee_paise: parseInt(form.per_km_fee_paise || "0", 10),
        base_distance_km: parseFloat(form.base_distance_km || "0"),
        free_delivery_above_paise: form.free_delivery_above_paise ? parseInt(form.free_delivery_above_paise, 10) : null,
        surge_multiplier: parseFloat(form.surge_multiplier || "1.0"),
        surge_enabled: form.surge_enabled,
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
          <p className="text-zinc-400 text-sm font-medium">Configure flat vs per-km delivery fees and surge pricing for each zone.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-white/[0.04] rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {zones.map(zone => (
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
                {editing !== zone.id ? (
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

              {editing === zone.id ? (
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-6 border-t border-white/5 bg-white/[0.02]">
                  {field("Fee Type", "delivery_fee_type", "select")}
                  
                  {form.delivery_fee_type === 'per_km' ? (
                    <>
                      {field("Base Fee (paise)", "base_delivery_fee_paise", "number")}
                      {field("Per KM Rate (paise)", "per_km_fee_paise", "number")}
                      {field("Base Distance (KM)", "base_distance_km", "number")}
                    </>
                  ) : (
                    <>
                      {field("Flat Fee (paise)", "base_delivery_fee_paise", "number")}
                    </>
                  )}

                  <div className="col-span-full border-t border-white/5 my-2" />
                  
                  {field("Free Delivery Above (paise)", "free_delivery_above_paise", "number", "e.g. 30000")}
                  {field("Surge Multiplier", "surge_multiplier", "number", "1.0")}
                  {field("Surge Enabled", "surge_enabled", "checkbox")}
                </div>
              ) : (
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Type", value: zone.delivery_fee_type === 'per_km' ? 'Per KM' : 'Flat', icon: Bike },
                    { label: "Base Fee", value: `₹${(zone.base_delivery_fee_paise || zone.delivery_fee_base_paise) / 100}`, icon: DollarSign },
                    { label: "Base Dist.", value: zone.delivery_fee_type === 'per_km' ? `${zone.base_distance_km || 0} km` : '—', icon: MapPin },
                    { label: "Per KM Rate", value: zone.delivery_fee_type === 'per_km' ? `₹${(zone.per_km_fee_paise || 0) / 100} / km` : '—', icon: MapPin },
                    { label: "Free Above", value: zone.free_delivery_above_paise ? `₹${zone.free_delivery_above_paise / 100}` : '—', icon: DollarSign },
                    { label: "Surge Mult.", value: `${zone.surge_multiplier || 1.0}x`, icon: Percent },
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
          ))}
        </div>
      )}
    </div>
  );
}
