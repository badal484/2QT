'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, ToggleLeft, ToggleRight, QrCode, Users,
  CheckCircle2, Search, ChevronLeft, ChevronRight, X,
  Wallet, RefreshCw, Settings2, ExternalLink, Eye,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { api } from '../lib/api';
import { toast } from 'sonner';

// ── tiny helpers ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'zinc' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const accent: Record<string, string> = {
    orange: 'text-brand-primary',
    green:  'text-emerald-400',
    blue:   'text-blue-400',
    zinc:   'text-white',
  };
  return (
    <div className="bg-[#0e0e16] rounded-[20px] border border-white/[0.05] p-5 shadow-xl">
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-black ${accent[color] ?? 'text-white'} tabular-nums`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-white/[0.05] last:border-0">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          value ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'bg-white/5 text-zinc-500 border border-white/10'
        }`}
      >
        {value ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// mini bar chart (no recharts dependency)
function MiniBar({ data, colorClass = 'bg-brand-primary' }: { data: { label: string; count: string | number }[]; colorClass?: string }) {
  const max = Math.max(...data.map(d => Number(d.count)), 1);
  return (
    <div className="space-y-2 mt-3">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-28 truncate flex-shrink-0">{d.label}</span>
          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(Number(d.count) / max) * 100}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${colorClass}`}
            />
          </div>
          <span className="text-xs font-bold text-zinc-300 w-6 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function PreLaunchTab() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [stats, setStats]   = useState<any>(null);
  const [regs, setRegs]     = useState<any[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading]  = useState(true);
  const [showQR, setShowQR]         = useState(false);
  const [viewingReg, setViewingReg] = useState<any | null>(null);
  const [creditingId, setCreditingId] = useState<string | null>(null);
  const [rewardPaise, setRewardPaise] = useState('10000');
  const [validityDays, setValidityDays] = useState('7');
  const [targetReg, setTargetReg] = useState('2000');
  const [savingConfig, setSavingConfig] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const landingUrl = typeof window !== 'undefined' ? `${window.location.origin}/prelaunch` : 'https://go2qt.com/prelaunch';

  const load = useCallback(async (p = page, q = search) => {
    try {
      const [cfgResult, statsResult, regsResult] = await Promise.allSettled([
        api.get('/prelaunch/config'),
        api.get('/prelaunch/admin/stats'),
        api.get(`/prelaunch/registrations?page=${p}&limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`),
      ]);

      if (cfgResult.status === 'fulfilled') {
        const cfgRes = cfgResult.value;
        setConfig(cfgRes.config || {});
        const rp = cfgRes.config?.prelaunch_reward_paise;
        const vd = cfgRes.config?.prelaunch_reward_validity_days;
        const tg = cfgRes.config?.prelaunch_target;
        if (rp !== undefined) setRewardPaise(String(rp));
        if (vd !== undefined) setValidityDays(String(vd));
        if (tg !== undefined) setTargetReg(String(tg));
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        console.error('[PreLaunch] Stats failed:', statsResult.reason?.message);
      }

      if (regsResult.status === 'fulfilled') {
        setRegs(regsResult.value.data || []);
        setTotal(regsResult.value.total || 0);
      } else {
        console.error('[PreLaunch] Registrations failed:', regsResult.reason?.message);
      }

      const anyFailed = [cfgResult, statsResult, regsResult].some(r => r.status === 'rejected');
      if (anyFailed) toast.error('Some data failed to load — backend may need a restart');
    } catch {
      toast.error('Failed to load pre-launch data');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, []);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handlePageChange = (p: number) => {
    setPage(p);
    load(p, search);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    load(1, q);
  };

  const toggle = async (key: string, current: boolean) => {
    const next = !current;
    try {
      // Optimistic
      setConfig(c => ({ ...c, [key]: next }));
      await api.post('/prelaunch/config', { [key]: next });
      toast.success(`${next ? 'Enabled' : 'Disabled'} successfully`);
    } catch {
      setConfig(c => ({ ...c, [key]: current })); // rollback
      toast.error('Failed to update');
    }
  };

  const saveRewardConfig = async () => {
    setSavingConfig(true);
    try {
      await api.post('/prelaunch/config', {
        prelaunch_reward_paise:         parseInt(rewardPaise, 10),
        prelaunch_reward_validity_days: parseInt(validityDays, 10),
        prelaunch_target:               parseInt(targetReg, 10),
      });
      toast.success('Reward config saved');
      load();
    } catch {
      toast.error('Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const manualCredit = async (id: string) => {
    setCreditingId(id);
    try {
      await api.post(`/prelaunch/admin/credit/${id}`, {});
      toast.success('₹100 reward credited to wallet');
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed';
      if (msg === 'ALREADY_CREDITED') toast.error('Already credited');
      else if (msg === 'USER_NOT_FOUND') toast.error('User not on app yet — they must log in first');
      else toast.error(msg);
    } finally {
      setCreditingId(null);
    }
  };

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem('2qt_token');
      const blob = await fetch('/api/proxy/prelaunch/export', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.blob());
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prelaunch-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas  = document.createElement('canvas');
    canvas.width  = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 40, 40, 320, 320);
      const link = document.createElement('a');
      link.download = '2qt-prelaunch-qr.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const isGateOn    = config['IS_PRELAUNCH_MODE']     === true  || config['IS_PRELAUNCH_MODE']     === 'true';
  const isRewardOn  = config['prelaunch_reward_active'] === true || config['prelaunch_reward_active'] === 'true';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">Pre-Launch</h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">Market research campaign · Launching August 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => load()} className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/10 transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <a href="/prelaunch" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-brand-primary rounded-xl text-sm font-bold text-white hover:bg-brand-primary-dark transition-colors shadow-[0_0_20px_rgba(255,107,53,0.3)]">
            <ExternalLink className="w-4 h-4" />
            View Page
          </a>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Registrations" value={(stats?.total ?? 0).toLocaleString('en-IN')} sub="since campaign start" color="orange" />
        <StatCard label="Target" value={parseInt(targetReg || '2000', 10).toLocaleString('en-IN')} sub={`${Math.round(((stats?.total ?? 0) / parseInt(targetReg || '2000', 10)) * 100)}% reached`} color="zinc" />
        <StatCard label="Rewards Credited" value={stats?.credited ?? 0} sub="wallet credits issued" color="green" />
        <StatCard label="Rewards Redeemed" value={stats?.redeemed ?? 0} sub="orders placed using reward" color="blue" />
      </div>

      {/* ── Control Panel + QR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Toggles */}
        <div className="lg:col-span-2 bg-[#0e0e16] rounded-[20px] border border-white/[0.05] p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <Settings2 className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Campaign Controls</h3>
          </div>

          <Toggle
            label="Website Gate"
            desc="When ON — visitors can only see /prelaunch, all other pages are blocked"
            value={isGateOn}
            onChange={() => toggle('IS_PRELAUNCH_MODE', isGateOn)}
          />
          <Toggle
            label="Reward Active"
            desc="When ON — users who registered will receive ₹100 on their first login after launch"
            value={isRewardOn}
            onChange={() => toggle('prelaunch_reward_active', isRewardOn)}
          />

          {/* Editable config */}
          <div className="pt-4 grid grid-cols-3 gap-4 mt-2">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Reward Amount (paise)</label>
              <input
                type="number"
                value={rewardPaise}
                onChange={e => setRewardPaise(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-bold outline-none focus:border-brand-primary transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">= ₹{(parseInt(rewardPaise || '0', 10) / 100).toFixed(0)}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Validity (days)</label>
              <input
                type="number"
                value={validityDays}
                onChange={e => setValidityDays(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-bold outline-none focus:border-brand-primary transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">days from launch date</p>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Target Registrations</label>
              <input
                type="number"
                value={targetReg}
                onChange={e => setTargetReg(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-bold outline-none focus:border-brand-primary transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">registration goal</p>
            </div>
          </div>
          <button
            onClick={saveRewardConfig}
            disabled={savingConfig}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl text-sm font-bold hover:bg-brand-primary/20 transition-colors disabled:opacity-50"
          >
            {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Save Config
          </button>
        </div>

        {/* QR Code */}
        <div className="bg-[#0e0e16] rounded-[20px] border border-white/[0.05] p-6 shadow-xl flex flex-col items-center justify-between gap-4">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">QR Code</h3>
            <button
              onClick={() => setShowQR(v => !v)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showQR ? 'Hide' : 'Show'}
            </button>
          </div>

          <AnimatePresence>
            {showQR ? (
              <motion.div
                key="qr"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                ref={qrRef}
                className="bg-white p-4 rounded-2xl"
              >
                <QRCode value={landingUrl} size={168} />
              </motion.div>
            ) : (
              <motion.button
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowQR(true)}
                className="w-full flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/5 border-2 border-dashed border-white/10 py-10 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all group cursor-pointer"
              >
                <QrCode className="w-10 h-10 text-zinc-600 group-hover:text-brand-primary transition-colors" />
                <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">Tap to reveal</p>
              </motion.button>
            )}
          </AnimatePresence>

          <div className="w-full space-y-2">
            <p className="text-[10px] text-zinc-600 break-all text-center font-mono">{landingUrl}</p>
            {showQR && (
              <button
                onClick={downloadQR}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-zinc-300 hover:bg-white/10 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0e0e16] rounded-[20px] border border-white/[0.05] p-6 shadow-xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Spend Per Order</h3>
            {stats.spendPerOrder?.length ? (
              <MiniBar data={stats.spendPerOrder} colorClass="bg-brand-primary" />
            ) : (
              <p className="text-xs text-zinc-600 mt-4">No data yet</p>
            )}
          </div>
          <div className="bg-[#0e0e16] rounded-[20px] border border-white/[0.05] p-6 shadow-xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Meal Preference</h3>
            {stats.mealPreference?.length ? (
              <MiniBar data={stats.mealPreference} colorClass="bg-blue-500" />
            ) : (
              <p className="text-xs text-zinc-600 mt-4">No data yet</p>
            )}
          </div>
          <div className="bg-[#0e0e16] rounded-[20px] border border-white/[0.05] p-6 shadow-xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Top Institutions</h3>
            {stats.topInstitutions?.length ? (
              <MiniBar data={stats.topInstitutions.map((c: any) => ({ label: c.name, count: c.count }))} colorClass="bg-emerald-500" />
            ) : (
              <p className="text-xs text-zinc-600 mt-4">No data yet</p>
            )}
          </div>
        </div>
      )}

      {/* ── Registrations Table ── */}
      <div className="bg-[#0e0e16] rounded-[20px] border border-white/[0.05] overflow-hidden shadow-xl">
        {/* Table header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-bold text-white">Registrations</h3>
            <span className="text-xs text-zinc-600 font-medium">({total.toLocaleString('en-IN')} total)</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search name or phone…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand-primary/50 transition-colors"
            />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Registered', 'Name', 'Phone', 'Person Type', 'Institution', 'Reward'].map(h => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {regs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs font-bold text-zinc-600 uppercase tracking-widest">
                    {search ? 'No results found' : 'No registrations yet'}
                  </td>
                </tr>
              ) : regs.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-3.5 text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-white whitespace-nowrap">{r.name}</td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400 font-mono whitespace-nowrap">
                    {r.phone ? (() => { const p = r.phone.replace(/^\+/, ''); return `+${p.slice(0,2)} ${p.slice(2,7)} ${p.slice(7)}`; })() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400 max-w-[140px] truncate">
                    {r.survey_responses?.personType || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400 max-w-[160px] truncate">
                    {r.survey_responses?.institution || r.survey_responses?.college || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {r.reward_credited ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Credited
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500 text-xs font-bold">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => setViewingReg(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-zinc-400 hover:border-blue-400/40 hover:text-blue-400 hover:bg-blue-400/5 transition-all"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                      {!r.reward_credited && (
                        <button
                          onClick={() => manualCredit(r.id)}
                          disabled={creditingId === r.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-zinc-400 hover:border-brand-primary/40 hover:text-brand-primary hover:bg-brand-primary/5 transition-all disabled:opacity-50"
                        >
                          <Wallet className="w-3 h-3" />
                          {creditingId === r.id ? '…' : 'Credit'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.05]">
            <p className="text-xs text-zinc-600">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Survey Detail Modal ── */}
      <AnimatePresence>
        {viewingReg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setViewingReg(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0e0e16] border border-white/10 rounded-[20px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-base font-bold text-white">{viewingReg.name}</p>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {viewingReg.phone ? (() => { const p = viewingReg.phone.replace(/^\+/, ''); return `+${p.slice(0,2)} ${p.slice(2,7)} ${p.slice(7)}`; })() : '—'}
                  </p>
                </div>
                <button onClick={() => setViewingReg(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Survey answers */}
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
                {viewingReg.survey_responses && Object.keys(viewingReg.survey_responses).length > 0 ? (
                  ([
                    { key: 'personType',        label: 'Who are you?' },
                    { key: 'institution',       label: 'School / College / Coaching' },
                    { key: 'stayType',          label: 'Where do you stay?' },
                    { key: 'orderFrequency',    label: 'How often order online?' },
                    { key: 'deliveryApps',      label: 'Delivery apps used' },
                    { key: 'biggestProblems',   label: 'Biggest problems' },
                    { key: 'spendPerOrder',     label: 'Spend per order' },
                    { key: 'cuisines',          label: 'Favourite cuisines' },
                    { key: 'mostOrderedDishes', label: 'Most ordered dishes' },
                    { key: 'mealPreference',    label: 'Meal preference' },
                    { key: 'orderTime',         label: 'Order time' },
                    { key: 'waitTime',          label: 'Willing to wait' },
                    { key: 'priorities',        label: 'Top priorities' },
                    { key: 'wantedFeatures',    label: 'Wanted app features' },
                    { key: 'convincingOffer',   label: 'Most convincing offer' },
                    { key: 'chooseOver',        label: 'Would choose 2QT over others for' },
                    { key: 'wishFeature',       label: 'Wish existed in Ranchi' },
                    { key: 'earlyAccess',       label: 'Wants early access?' },
                  ] as { key: string; label: string }[]).map(({ key, label }) => {
                    const val = viewingReg.survey_responses[key];
                    if (val === undefined || val === null || val === '') return null;
                    const display = Array.isArray(val) ? val.join(', ') : String(val);
                    if (!display) return null;
                    return (
                      <div key={key}>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{label}</p>
                        <p className="text-sm text-zinc-200 font-medium">{display}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-600 text-center py-8">No survey answers recorded</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
