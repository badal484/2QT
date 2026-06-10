"use client";

import { useState, useEffect } from "react";
import { Plus, X, Trash2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";

const MapPicker = dynamic(() => import("../../components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-56 bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-center text-zinc-500 text-xs">
      Loading map…
    </div>
  ),
});

export function KitchensTab() {
  const [kitchens, setKitchens] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const [staffKitchenId, setStaffKitchenId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ name: "", phone: "" });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, action: 'delete_kitchen' | 'remove_chef' | null, id: string | null }>({ isOpen: false, action: null, id: null });

  const load = async () => {
    try {
      const kData = await api.get("/admin/kitchens");
      setKitchens(kData.kitchens ?? []);
      const zData = await api.get("/admin/zones");
      setZones(zData.zones ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = {
        ...form,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
      };
      if (editing) {
        await api.patch(`/admin/kitchens/${editing}`, payload);
        toast.success("Kitchen updated");
      } else {
        await api.post("/admin/kitchens", payload);
        toast.success("Kitchen created");
      }
      setEditing(null);
      setAdding(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save kitchen");
    }
  };

  const executeDeleteKitchen = async (id: string) => {
    try {
      await api.delete(`/admin/kitchens/${id}`);
      toast.success("Kitchen deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const deleteKitchen = (id: string) => {
    setConfirmDialog({ isOpen: true, action: 'delete_kitchen', id });
  };

  const loadStaff = async (kId: string) => {
    setStaffKitchenId(kId);
    const data = await api.get(`/admin/kitchens/${kId}/staff`);
    setStaffList(data.staff ?? []);
  };

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/admin/kitchens/${staffKitchenId}/staff`, staffForm);
      toast.success("Chef assigned!");
      setStaffForm({ name: "", phone: "" });
      loadStaff(staffKitchenId!);
    } catch (err: any) {
      toast.error(err.message || "Failed to add chef");
    }
  };

  const executeRemoveStaff = async (staffId: string) => {
    try {
      await api.delete(`/admin/kitchens/${staffKitchenId}/staff/${staffId}`);
      toast.success("Chef removed");
      loadStaff(staffKitchenId!);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove chef");
    }
  };

  const removeStaff = (staffId: string) => {
    setConfirmDialog({ isOpen: true, action: 'remove_chef', id: staffId });
  };

  const field = (label: string, key: string) => (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      <input type="text" value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-white/[0.02] backdrop-blur-lg border border-white/10 rounded-xl px-4 py-3 font-bold text-sm outline-none text-white focus:ring-2 focus:ring-brand-primary/50" />
    </div>
  );

  // Map picker center: use existing kitchen coords when editing, default otherwise
  const mapCenter: [number, number] = [
    form.lat ? Number(form.lat) : 12.9716,
    form.lng ? Number(form.lng) : 77.5946,
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Kitchens</h2>
          <p className="text-zinc-400 text-sm font-medium">Manage physical kitchen locations and chefs.</p>
        </div>
        {!adding && !editing && (
          <button onClick={() => { setForm({}); setAdding(true); }}
            className="bg-brand-primary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-dark flex items-center gap-2 shadow-lg shadow-brand-primary/30">
            <Plus className="w-4 h-4" /> New Kitchen
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 bg-white/[0.04] backdrop-blur-xl rounded-2xl animate-pulse" />)}</div>
      ) : adding || editing ? (
        <div className="bg-[#0b0b13] border border-white/10 rounded-2xl p-6 mb-8 relative">
          <button onClick={() => { setAdding(false); setEditing(null); }} className="absolute top-4 right-4 p-2 bg-white/[0.05] rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-wider">{editing ? "Edit Kitchen" : "New Kitchen"}</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="col-span-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Serving Zones (Select multiple)</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {zones.map(z => {
                  const isSelected = (form.zone_ids || []).includes(z.id);
                  return (
                    <label key={z.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-brand-primary/10 border-brand-primary/50 text-brand-primary' : 'bg-[#11111a] border-white/10 text-white hover:bg-white/5'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const current = form.zone_ids || [];
                          if (e.target.checked) setForm({...form, zone_ids: [...current, z.id]});
                          else setForm({...form, zone_ids: current.filter((id: string) => id !== z.id)});
                        }}
                        className="w-4 h-4 rounded accent-brand-primary"
                      />
                      <span className="text-sm font-bold truncate">{z.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {field("Kitchen Name", "name")}
            {field("FSSAI License", "fssai_license")}
            {field("GSTIN", "gstin")}
            {field("Address", "address")}
          </div>

          {/* Kitchen Location Picker */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Kitchen Location
              </div>
              {form.lat && form.lng && (
                <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/10">
                  {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
                </span>
              )}
            </div>
            <div className="h-56 rounded-xl overflow-hidden">
              {/* key forces remount with correct center when switching between edit/create */}
              <MapPicker
                key={editing || "new"}
                defaultCenter={mapCenter}
                onLocationSelect={({ lat, lng }) => {
                  setForm((prev: any) => ({ ...prev, lat, lng }));
                }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5">Click on the map or drag the pin to set the kitchen's exact location.</p>
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={!form.name || !form.zone_ids || form.zone_ids.length === 0}
              className="bg-brand-primary text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-dark disabled:opacity-50">
              {editing ? "Save Changes" : "Create Kitchen"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {kitchens.map(k => (
            <div key={k.id} className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${k.is_active ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
                  <div>
                    <div className="font-black text-white text-lg flex items-center gap-2">
                      {k.name}
                      <div className="flex gap-1 flex-wrap">
                        {k.zones?.map((z: any) => <span key={z.id} className="px-2 py-0.5 rounded bg-brand-primary/20 text-brand-primary text-[9px] font-black uppercase">{z.name}</span>)}
                        {(!k.zones || k.zones.length === 0) && <span className="px-2 py-0.5 rounded bg-white/10 text-white/50 text-[9px] font-black uppercase">No Zone</span>}
                      </div>
                    </div>
                    <div className="text-[10px] font-semibold text-zinc-400 tracking-wider flex items-center gap-3">
                      <span>FSSAI: {k.fssai_license || 'N/A'}</span>
                      {k.lat && k.lng && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {Number(k.lat).toFixed(4)}, {Number(k.lng).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteKitchen(k.id)}
                    className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                    Delete
                  </button>
                  <button onClick={() => { setForm({...k, zone_ids: k.zones?.map((z: any) => z.id) || []}); setEditing(k.id); }}
                    className="px-4 py-2 rounded-xl bg-white/[0.05] text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                    Edit
                  </button>
                  <button onClick={() => loadStaff(k.id)}
                    className="px-4 py-2 rounded-xl bg-brand-primary/15 text-brand-primary text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/25 transition-all">
                    Manage Staff
                  </button>
                </div>
              </div>

              {staffKitchenId === k.id && (
                <div className="p-5 bg-white/[0.01] border-t border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Assigned Chefs</div>
                    <button onClick={() => setStaffKitchenId(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4"/></button>
                  </div>

                  <div className="space-y-2 mb-4">
                    {staffList.length === 0 ? <div className="text-xs text-zinc-500">No chefs assigned yet.</div> : staffList.map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.is_online ? 'bg-green-500' : 'bg-zinc-600'}`}/>
                          <span className="text-sm font-bold text-white">{s.name}</span>
                          <span className="text-xs text-zinc-400 ml-2">{s.phone}</span>
                        </div>
                        <button onClick={() => removeStaff(s.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={addStaff} className="flex gap-2">
                    <input type="text" placeholder="Chef Name" required value={staffForm.name} onChange={e=>setStaffForm({...staffForm, name: e.target.value})}
                      className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                    <input type="tel" placeholder="Phone Number" required value={staffForm.phone} onChange={e=>setStaffForm({...staffForm, phone: e.target.value})}
                      className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                    <button type="submit" className="bg-brand-primary text-white px-4 py-2 rounded-xl text-xs font-bold">Add Chef</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'delete_kitchen' ? "Delete Kitchen?" : "Remove Chef?"}
        message={confirmDialog.action === 'delete_kitchen' ? "Are you sure you want to delete this kitchen? All chefs assigned to it will be unassigned." : "Are you sure you want to remove this chef from the kitchen? They will no longer receive orders for this zone."}
        confirmText={confirmDialog.action === 'delete_kitchen' ? "Delete Kitchen" : "Remove Chef"}
        onConfirm={() => {
          if (confirmDialog.action === 'delete_kitchen' && confirmDialog.id) executeDeleteKitchen(confirmDialog.id);
          if (confirmDialog.action === 'remove_chef' && confirmDialog.id) executeRemoveStaff(confirmDialog.id);
          setConfirmDialog({ isOpen: false, action: null, id: null });
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
        isDanger={true}
      />
    </div>
  );
}
