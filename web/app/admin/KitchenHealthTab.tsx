"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { ShieldCheck, Thermometer, Droplets, Utensils, RefreshCw, Save } from "lucide-react";

export function KitchenHealthTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/admin/zones").then(data => {
      setZones(data.zones || []);
      if (data.zones?.length > 0) setSelectedZone(data.zones[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedZone) return;
    setLoading(true);
    api.get(`/admin/zones/${selectedZone}/metrics`).then(data => {
      setMetrics(data.metrics || {
        fssai_status: 'FSSAI Certified',
        fssai_valid_till: 'Valid \'27',
        staff_temp_value: '98.6°F Staff Temp',
        staff_temp_time: '10m ago',
        sanitization_percent: '100% Sanitized',
        sanitization_freq: 'Hourly',
        pure_veg_status: '100% Pure Veg',
        pure_veg_audited: 'Audited'
      });
      setLoading(false);
    });
  }, [selectedZone]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone) return;
    try {
      await api.put(`/admin/zones/${selectedZone}/metrics`, metrics);
      toast.success("Kitchen metrics updated!");
    } catch (err) {
      toast.error("Failed to update metrics");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Kitchen Health</h2>
          <p className="text-zinc-400 text-sm font-medium">Update live hygiene metrics shown to customers.</p>
        </div>
        <select
          value={selectedZone || ''}
          onChange={(e) => setSelectedZone(e.target.value)}
          className="bg-[#1a1a2e] border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-brand-primary"
        >
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 text-brand-primary animate-spin" /></div>
      ) : metrics && (
        <form onSubmit={handleSave} className="bg-[#11111a] border border-white/[0.05] rounded-[24px] p-8 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* FSSAI */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="text-white font-bold text-lg">FSSAI Status</h3>
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Title</label>
                <input type="text" value={metrics.fssai_status} onChange={e => setMetrics({...metrics, fssai_status: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Subtitle / Validity</label>
                <input type="text" value={metrics.fssai_valid_till} onChange={e => setMetrics({...metrics, fssai_valid_till: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
            </div>

            {/* Staff Temp */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-white font-bold text-lg">Staff Temp</h3>
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Value</label>
                <input type="text" value={metrics.staff_temp_value} onChange={e => setMetrics({...metrics, staff_temp_value: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Last Checked</label>
                <input type="text" value={metrics.staff_temp_time} onChange={e => setMetrics({...metrics, staff_temp_time: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
            </div>

            {/* Sanitization */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-white font-bold text-lg">Sanitization</h3>
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Percent</label>
                <input type="text" value={metrics.sanitization_percent} onChange={e => setMetrics({...metrics, sanitization_percent: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Frequency</label>
                <input type="text" value={metrics.sanitization_freq} onChange={e => setMetrics({...metrics, sanitization_freq: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
            </div>

            {/* Pure Veg */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-yellow-500" />
                </div>
                <h3 className="text-white font-bold text-lg">Dietary Info</h3>
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Status</label>
                <input type="text" value={metrics.pure_veg_status} onChange={e => setMetrics({...metrics, pure_veg_status: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Audit Info</label>
                <input type="text" value={metrics.pure_veg_audited} onChange={e => setMetrics({...metrics, pure_veg_audited: e.target.value})} className="w-full mt-1 bg-white/[0.02] border border-white/10 text-white rounded-xl px-4 py-3 outline-none" />
              </div>
            </div>

          </div>

          <div className="mt-8 flex justify-end">
            <button type="submit" className="px-8 py-4 bg-brand-primary text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#E55A2B] transition-colors">
              <Save className="w-5 h-5" /> Save Metrics Live
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
