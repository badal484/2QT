import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Download, ToggleLeft, ToggleRight, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

export function PreLaunchTab() {
  const [isPrelaunch, setIsPrelaunch] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const loadData = async () => {
    try {
      const [configRes, regsRes] = await Promise.all([
        api.get('/prelaunch/config'),
        api.get('/prelaunch/registrations')
      ]);
      setIsPrelaunch(configRes.isPrelaunch);
      setRegistrations(regsRes.data || []);
    } catch (e) {
      toast.error('Failed to load pre-launch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePrelaunch = async () => {
    try {
      await api.post('/prelaunch/config', { isPrelaunch: !isPrelaunch });
      setIsPrelaunch(!isPrelaunch);
      toast.success(`Pre-launch mode is now ${!isPrelaunch ? 'ON' : 'OFF'}`);
    } catch (e) {
      toast.error('Failed to toggle pre-launch mode');
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Source', 'Cuisine', 'Date'];
    const csvData = registrations.map(r => [
      r.name,
      r.email || '',
      r.phone || '',
      r.source || 'organic',
      r.survey_responses?.cuisine || '',
      new Date(r.created_at).toLocaleString()
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `waitlist_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const landingUrl = typeof window !== 'undefined' ? `${window.location.origin}/prelaunch` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">Waitlist & Pre-Launch</h2>
          <p className="text-zinc-400 text-sm font-medium">Manage your launch waitlist and registration gating.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={togglePrelaunch}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isPrelaunch ? 'bg-brand-primary text-white shadow-lg' : 'bg-white/[0.05] text-zinc-400'
            }`}
          >
            {isPrelaunch ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {isPrelaunch ? 'Pre-Launch ON' : 'Pre-Launch OFF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#11111a] rounded-[20px] border border-white/[0.05] p-5 shadow-xl">
          <p className="text-sm font-semibold text-zinc-400 mb-1">Total Registrations</p>
          <h3 className="text-3xl font-black text-white">{registrations.length}</h3>
        </div>
        <div className="bg-[#11111a] rounded-[20px] border border-white/[0.05] p-5 shadow-xl flex items-center justify-between cursor-pointer" onClick={() => setShowQR(!showQR)}>
          <div>
            <p className="text-sm font-semibold text-zinc-400 mb-1">Landing Page QR</p>
            <p className="text-xs text-zinc-500">Tap to {showQR ? 'hide' : 'view'} code</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <QrCode className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="bg-[#11111a] rounded-[20px] border border-white/[0.05] p-5 shadow-xl flex items-center justify-between cursor-pointer" onClick={exportCSV}>
          <div>
            <p className="text-sm font-semibold text-zinc-400 mb-1">Export Data</p>
            <p className="text-xs text-zinc-500">Download CSV file</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Download className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {showQR && (
        <div className="bg-[#11111a] rounded-[20px] border border-white/[0.05] p-8 shadow-xl flex flex-col items-center justify-center mb-8">
          <div className="bg-white p-4 rounded-xl mb-4">
            <QRCode value={landingUrl} size={200} />
          </div>
          <p className="text-zinc-400 font-medium">Scan to open the pre-launch waitlist page.</p>
          <p className="text-xs text-brand-primary mt-2 break-all">{landingUrl}</p>
        </div>
      )}

      <div className="bg-[#11111a] rounded-[20px] border border-white/[0.05] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.05]">
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Source</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Cuisine</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : registrations.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">No registrations yet</td></tr>
            ) : (
              registrations.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-400">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-white">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{r.email || r.phone}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400 capitalize">{r.source}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.survey_responses?.cuisine || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
