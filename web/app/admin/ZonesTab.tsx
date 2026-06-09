"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import dynamic from "next/dynamic";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";

const MapPolygonPicker = dynamic(() => import("../../components/MapPolygonPicker"), { ssr: false });

const EMPTY_ZONE = {
  name: "", city: "Bengaluru",
  polygon_points: [], delivery_fee_base_paise: "2500",
  opening_time: "10:00", closing_time: "22:00",
  max_orders_per_hour: "60", realistic_delivery_minutes: "15",
};

export function ZonesTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<any>({ ...EMPTY_ZONE });
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  const load = async () => {
    try {
      const data = await api.get("/admin/zones");
      setZones(data.zones ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createZone = async () => {
    if (!addForm.name) {
      toast.error("Name is required");
      return;
    }
    if (!addForm.polygon_points || addForm.polygon_points.length < 3) {
      toast.error("Please draw a delivery zone polygon on the map with at least 3 points.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/zones", {
        ...addForm,
        kitchen_lat: addForm.polygon_points[0].lat,
        kitchen_lng: addForm.polygon_points[0].lng,
        radius_km: 0,
        delivery_fee_base_paise: parseInt(addForm.delivery_fee_base_paise),
        max_orders_per_hour: parseInt(addForm.max_orders_per_hour),
        realistic_delivery_minutes: parseInt(addForm.realistic_delivery_minutes),
      });
      setShowAdd(false);
      setAddForm({ ...EMPTY_ZONE });
      load();
      toast.success("Zone created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create zone");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (zone: any) => {
    setEditing(zone.id);
    setForm({
      name: zone.name,
      polygon_points: zone.polygon_points || [],
      delivery_fee_base_paise: zone.delivery_fee_base_paise,
      opening_time: zone.opening_time,
      closing_time: zone.closing_time,
      max_orders_per_hour: zone.max_orders_per_hour,
      realistic_delivery_minutes: zone.realistic_delivery_minutes,
      is_active: zone.is_active,
      surge_enabled: zone.surge_enabled,
    });
  };

  const save = async (id: string) => {
    await api.patch(`/admin/zones/${id}`, {
      ...form,
      radius_km: 0,
      delivery_fee_base_paise: parseInt(form.delivery_fee_base_paise),
      max_orders_per_hour: parseInt(form.max_orders_per_hour),
      realistic_delivery_minutes: parseInt(form.realistic_delivery_minutes),
    });
    setEditing(null);
    load();
    toast.success("Zone updated");
  };

  const executeDeleteZone = async (id: string) => {
    try {
      await api.delete(`/admin/zones/${id}`);
      toast.success("Zone deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete zone");
    }
  };

  const deleteZone = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  const field = (label: string, key: string, type = "text") => (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      {type === "checkbox" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })}
            className="w-4 h-4 accent-brand-primary rounded" />
          <span className="text-xs font-semibold text-white">{form[key] ? "Yes" : "No"}</span>
        </label>
      ) : (
        <input type={type} value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50" />
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Delivery Zones</h2>
          <p className="text-zinc-400 text-sm font-medium">Control radius, delivery fees, and operating hours per zone.</p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddForm({ ...EMPTY_ZONE }); }}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/30"
        >
          <Plus className="w-4 h-4" /> New Zone
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 bg-white/[0.04] backdrop-blur-2xl border border-brand-primary/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <span className="text-sm font-black text-white uppercase tracking-wider">New Zone</span>
            <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4 border-b border-white/5">
            <div className="col-span-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Delivery Zone Boundary</div>
              <MapPolygonPicker
                polygonPoints={addForm.polygon_points || []}
                onChange={(points) => setAddForm((f: any) => ({ ...f, polygon_points: points }))}
              />
            </div>
            {[
              { label: "Zone Name", key: "name", type: "text", placeholder: "e.g. Koramangala" },
              { label: "City", key: "city", type: "text", placeholder: "Bengaluru" },
              { label: "Delivery Fee (paise)", key: "delivery_fee_base_paise", type: "number", placeholder: "2500" },
              { label: "Opens At", key: "opening_time", type: "time", placeholder: "" },
              { label: "Closes At", key: "closing_time", type: "time", placeholder: "" },
              { label: "Max Orders/Hour", key: "max_orders_per_hour", type: "number", placeholder: "60" },
              { label: "Est. Delivery (min)", key: "realistic_delivery_minutes", type: "number", placeholder: "30" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
                <input
                  type={type} placeholder={placeholder} value={addForm[key]}
                  onChange={e => setAddForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50 placeholder:text-zinc-600"
                />
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl bg-white/[0.05] text-xs font-black uppercase tracking-widest text-white hover:bg-white/10">Cancel</button>
            <button onClick={createZone} disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-black uppercase tracking-widest hover:bg-brand-dark disabled:opacity-50 shadow-lg shadow-brand-primary/30">
              {saving ? "Creating…" : "Create Zone"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 bg-white/[0.04] rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {zones.map(zone => (
            <div key={zone.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
              {/* Zone header */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${zone.is_active ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
                  <div>
                    <div className="font-black text-white text-lg">{zone.name}</div>
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{zone.city}</div>
                  </div>
                </div>
                {editing !== zone.id ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => deleteZone(zone.id)}
                      className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                      Delete
                    </button>
                    <button onClick={() => startEdit(zone)}
                      className="px-4 py-2 rounded-xl bg-brand-primary/15 text-brand-primary text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/25 transition-all">
                      Edit Zone
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)}
                      className="px-3 py-2 rounded-xl bg-white/[0.05] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10">Cancel</button>
                    <button onClick={() => save(zone.id)}
                      className="px-4 py-2 rounded-xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-dark shadow-lg shadow-brand-primary/30">Save</button>
                  </div>
                )}
              </div>

              {editing === zone.id ? (
                <div className="p-5 grid grid-cols-2 gap-4 border-t border-white/5">
                  <div className="col-span-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Delivery Zone Boundary</div>
                    <MapPolygonPicker
                      polygonPoints={form.polygon_points || []}
                      onChange={(points) => setForm((f: any) => ({ ...f, polygon_points: points }))}
                    />
                  </div>
                  {field("Zone Name", "name")}
                  {field("Delivery Fee (paise)", "delivery_fee_base_paise", "number")}
                  {field("Opens At", "opening_time", "time")}
                  {field("Closes At", "closing_time", "time")}
                  {field("Max Orders/Hour", "max_orders_per_hour", "number")}
                  {field("Delivery Time (min)", "realistic_delivery_minutes", "number")}
                  {field("Active", "is_active", "checkbox")}
                  {field("Surge Enabled", "surge_enabled", "checkbox")}
                </div>
              ) : (
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Points", value: zone.polygon_points ? `${zone.polygon_points.length} nodes` : '0 nodes' },
                    { label: "Delivery Fee", value: `₹${zone.delivery_fee_base_paise / 100}` },
                    { label: "Hours", value: `${zone.opening_time?.slice(0,5)} – ${zone.closing_time?.slice(0,5)}` },
                    { label: "Max Orders/hr", value: zone.max_orders_per_hour },
                    { label: "Est. Delivery", value: `${zone.realistic_delivery_minutes} min` },
                    { label: "Surge", value: zone.surge_enabled ? "On" : "Off" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">{label}</div>
                      <div className="font-bold text-white text-sm">{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Delete Zone?"
        message="Are you sure you want to delete this delivery zone? All attached kitchens will also be removed. This action cannot be undone."
        confirmText="Delete Zone"
        onConfirm={() => {
          if (confirmDialog.id) executeDeleteZone(confirmDialog.id);
          setConfirmDialog({ isOpen: false, id: null });
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, id: null })}
        isDanger={true}
      />
    </div>
  );
}
