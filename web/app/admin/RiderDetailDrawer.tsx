"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  X, Phone, Bike, TrendingUp, Package, ShieldCheck, Wallet,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Star,
  Calendar, Clock, Camera, Car, FileText, Ban, RotateCcw,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RiderDetail {
  rider: {
    id: string; name: string; phone: string;
    is_verified: boolean; is_online: boolean; is_active: boolean;
    is_suspended: boolean; suspension_reason: string | null;
    suspended_at: string | null; created_at: string;
    payment_model: 'per_order' | 'salary';
    monthly_salary_paise: number | null;
    fuel_allowance_per_km_paise: number | null;
  };
  stats: { totalEarningsPaise: number; totalDeliveries: number; totalPaidPaise: number };
  earnings: Array<{ date: string; deliveries_count: string; total_paise: string; base_earnings_paise: string; bonus_earnings_paise: string }>;
  recentOrders: Array<{
    id: string; display_id: string; status: string;
    total_amount_paise: number; payment_method: string;
    created_at: string; delivered_at: string | null;
    pod_photo_url: string | null; customer_name: string;
  }>;
  documents: {
    vehicle_type: string; license_number: string; id_photo_url: string | null;
    doc_review_status: string; doc_review_reason: string | null; updated_at: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  delivered:        "text-green-400 bg-green-500/10",
  out_for_delivery: "text-blue-400 bg-blue-500/10",
  cancelled:        "text-red-400 bg-red-500/10",
  confirmed:        "text-yellow-400 bg-yellow-500/10",
  preparing:        "text-orange-400 bg-orange-500/10",
};

function BarChart({ data }: { data: Array<{ date: string; total_paise: string }> }) {
  const max = Math.max(...data.map(d => parseInt(d.total_paise, 10))) || 1;
  return (
    <div className="flex items-end gap-1 h-20 mt-2">
      {data.map((d, i) => {
        const pct = (parseInt(d.total_paise, 10) / max) * 100;
        const label = new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-zinc-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-10">
              ₹{(parseInt(d.total_paise, 10) / 100).toFixed(0)}
            </div>
            <div className="w-full rounded-t bg-zinc-700/40 overflow-hidden" style={{ height: "60px" }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, pct)}%` }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                className="w-full bg-orange-500 rounded-t"
              />
            </div>
            <span className="text-[8px] text-zinc-600 font-bold">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RiderDetailDrawer({ riderId, onClose }: { riderId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "earnings" | "orders" | "docs">("overview");
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [podLightbox, setPodLightbox] = useState<string | null>(null);

  // Contract form state
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [contractForm, setContractForm] = useState<{ payment_model: string; monthly_salary_rupees: string; fuel_allowance_rupees: string }>({
    payment_model: 'per_order', monthly_salary_rupees: '0', fuel_allowance_rupees: '0'
  });

  const { data, isLoading } = useQuery<RiderDetail>({
    queryKey: ["rider-detail", riderId],
    queryFn: () => api.get(`/admin/riders/${riderId}`),
  });

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/admin/riders/${riderId}/suspend`, { reason }),
    onSuccess: () => { toast.success("Rider suspended."); qc.invalidateQueries({ queryKey: ["rider-detail", riderId] }); qc.invalidateQueries({ queryKey: ["admin-rider-documents"] }); setShowSuspendForm(false); },
    onError: () => toast.error("Failed to suspend rider."),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => api.post(`/admin/riders/${riderId}/reactivate`, {}),
    onSuccess: () => { toast.success("Rider reactivated."); qc.invalidateQueries({ queryKey: ["rider-detail", riderId] }); qc.invalidateQueries({ queryKey: ["admin-rider-documents"] }); },
    onError: () => toast.error("Failed to reactivate rider."),
  });

  const docReviewMutation = useMutation({
    mutationFn: ({ action, reason }: { action: "approve" | "reject"; reason?: string }) =>
      api.patch(`/admin/riders/${riderId}/documents/review`, { action, reason }),
    onSuccess: (_, vars) => { toast.success(vars.action === "approve" ? "Documents approved!" : "Documents rejected."); qc.invalidateQueries({ queryKey: ["rider-detail", riderId] }); },
    onError: () => toast.error("Action failed."),
  });

  const contractMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/admin/riders/${riderId}/contract`, data),
    onSuccess: () => {
      toast.success("Contract updated.");
      setIsEditingContract(false);
      qc.invalidateQueries({ queryKey: ["rider-detail", riderId] });
    },
    onError: () => toast.error("Failed to update contract."),
  });

  const r = data?.rider;
  const stats = data?.stats;
  const chartData = (data?.earnings ?? []).slice(0, 7).reverse();

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "earnings", label: "Earnings" },
    { key: "orders",   label: "Orders" },
    { key: "docs",     label: "Documents" },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed right-0 top-0 h-full w-full max-w-xl z-50 bg-zinc-950 border-l border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Bike size={18} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-tight">{r?.name ?? "Rider"}</h2>
              <p className="text-zinc-500 text-xs font-medium">{r?.phone ?? "Loading…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {r?.is_suspended ? (
              <button
                onClick={() => reactivateMutation.mutate()}
                disabled={reactivateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/25 transition-all disabled:opacity-40"
              >
                <RotateCcw size={12} /> Reactivate
              </button>
            ) : (
              <button
                onClick={() => setShowSuspendForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all"
              >
                <Ban size={12} /> Suspend
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Suspend form */}
        <AnimatePresence>
          {showSuspendForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/8 overflow-hidden"
            >
              <div className="px-6 py-4 bg-red-500/5">
                <p className="text-xs text-red-400 font-bold mb-2">Reason for suspension</p>
                <div className="flex gap-2">
                  <input
                    value={suspendReason}
                    onChange={e => setSuspendReason(e.target.value)}
                    placeholder="e.g. Multiple complaints, fraud suspected…"
                    className="flex-1 bg-black/40 border border-red-500/20 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    onClick={() => suspendMutation.mutate(suspendReason)}
                    disabled={!suspendReason.trim() || suspendMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-all disabled:opacity-40"
                  >
                    {suspendMutation.isPending ? "…" : "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status bar */}
        {r && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-white/8 flex-wrap">
            {[
              { label: r.is_online ? "Online" : "Offline", cls: r.is_online ? "text-green-400 bg-green-500/10" : "text-zinc-500 bg-white/5" },
              { label: r.is_verified ? "Verified" : "Unverified", cls: r.is_verified ? "text-blue-400 bg-blue-500/10" : "text-yellow-400 bg-yellow-500/10" },
              { label: r.is_suspended ? "SUSPENDED" : "Active", cls: r.is_suspended ? "text-red-400 bg-red-500/10 font-black" : "text-green-400 bg-green-500/10" },
            ].map((s, i) => (
              <span key={i} className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${s.cls}`}>
                {s.label}
              </span>
            ))}
            {r.is_suspended && r.suspension_reason && (
              <span className="text-xs text-red-400/70">Reason: {r.suspension_reason}</span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/8 px-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
                tab === t.key ? "text-orange-400 border-orange-400" : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {tab === "overview" && (
                <div className="space-y-4">
                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: Wallet, label: "Total Earnings", value: `₹${((stats?.totalEarningsPaise ?? 0) / 100).toFixed(0)}`, color: "text-orange-400", bg: "bg-orange-500/10" },
                      { icon: Package, label: "Deliveries", value: stats?.totalDeliveries ?? 0, color: "text-blue-400", bg: "bg-blue-500/10" },
                      { icon: TrendingUp, label: "Paid Out", value: `₹${((stats?.totalPaidPaise ?? 0) / 100).toFixed(0)}`, color: "text-green-400", bg: "bg-green-500/10" },
                    ].map((s, i) => (
                      <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-4">
                        <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                          <s.icon size={15} className={s.color} />
                        </div>
                        <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* 7-day chart */}
                  {chartData.length > 0 && (
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                      <p className="text-xs text-zinc-400 font-bold uppercase tracking-wide mb-1">7-Day Earnings</p>
                      <BarChart data={chartData} />
                    </div>
                  )}

                  {/* Quick info */}
                  <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
                    {[
                      { icon: Phone, label: "Phone", value: r?.phone },
                      { icon: Calendar, label: "Joined", value: r?.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                      { icon: Bike, label: "Vehicle", value: data?.documents?.vehicle_type ? data.documents.vehicle_type.charAt(0).toUpperCase() + data.documents.vehicle_type.slice(1) : "Not submitted" },
                      { icon: FileText, label: "License", value: data?.documents?.license_number || "Not submitted" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <row.icon size={14} className="text-zinc-500 flex-shrink-0" />
                        <span className="text-xs text-zinc-500 w-20">{row.label}</span>
                        <span className="text-sm text-white font-semibold">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Contract Card */}
                  <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs text-zinc-400 font-bold uppercase tracking-wide">Employment Contract</p>
                      {!isEditingContract && (
                        <button onClick={() => {
                          setContractForm({
                            payment_model: r?.payment_model || 'per_order',
                            monthly_salary_rupees: String((r?.monthly_salary_paise || 0) / 100),
                            fuel_allowance_rupees: String((r?.fuel_allowance_per_km_paise || 0) / 100),
                          });
                          setIsEditingContract(true);
                        }} className="text-xs text-blue-400 font-bold hover:text-blue-300">Edit</button>
                      )}
                    </div>
                    
                    {isEditingContract ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Payment Model</label>
                          <select 
                            value={contractForm.payment_model}
                            onChange={e => setContractForm(s => ({ ...s, payment_model: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                          >
                            <option value="per_order">Gig (Per Order)</option>
                            <option value="salary">Salaried (Fixed Monthly)</option>
                          </select>
                        </div>
                        {contractForm.payment_model === 'salary' && (
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="text-xs text-zinc-500 mb-1 block">Monthly Salary (₹)</label>
                              <input 
                                type="number" 
                                value={contractForm.monthly_salary_rupees}
                                onChange={e => setContractForm(s => ({ ...s, monthly_salary_rupees: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-zinc-500 mb-1 block">Fuel / KM (₹)</label>
                              <input 
                                type="number" 
                                value={contractForm.fuel_allowance_rupees}
                                onChange={e => setContractForm(s => ({ ...s, fuel_allowance_rupees: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <button 
                            onClick={() => setIsEditingContract(false)}
                            className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => contractMutation.mutate({
                              payment_model: contractForm.payment_model,
                              monthly_salary_paise: parseInt(contractForm.monthly_salary_rupees) * 100 || 0,
                              fuel_allowance_per_km_paise: parseInt(contractForm.fuel_allowance_rupees) * 100 || 0
                            })}
                            disabled={contractMutation.isPending}
                            className="flex-1 px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-400 hover:bg-orange-500/30"
                          >
                            {contractMutation.isPending ? 'Saving...' : 'Save Contract'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Model</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${r?.payment_model === 'salary' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                            {r?.payment_model === 'salary' ? 'Salaried' : 'Gig (Per Order)'}
                          </span>
                        </div>
                        {r?.payment_model === 'salary' && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500">Monthly Salary</span>
                              <span className="text-sm text-white font-bold">₹{((r?.monthly_salary_paise || 0) / 100).toFixed(0)} / mo</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500">Fuel Allowance</span>
                              <span className="text-sm text-white font-bold">₹{((r?.fuel_allowance_per_km_paise || 0) / 100).toFixed(1)} / km</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EARNINGS */}
              {tab === "earnings" && (
                <div className="space-y-3">
                  {(data?.earnings ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                      <TrendingUp size={32} className="mb-2" />
                      <p className="text-sm font-bold">No earnings recorded yet</p>
                    </div>
                  ) : (data?.earnings ?? []).map((e, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-white font-bold text-sm">
                          {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {e.deliveries_count} deliveries
                          {parseInt(e.bonus_earnings_paise, 10) > 0 && ` · ₹${(parseInt(e.base_earnings_paise, 10) / 100).toFixed(0)} base + ₹${(parseInt(e.bonus_earnings_paise, 10) / 100).toFixed(0)} bonus`}
                        </p>
                      </div>
                      <p className="text-orange-400 font-black text-lg">₹{(parseInt(e.total_paise, 10) / 100).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ORDERS */}
              {tab === "orders" && (
                <div className="space-y-3">
                  {(data?.recentOrders ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                      <Package size={32} className="mb-2" />
                      <p className="text-sm font-bold">No orders yet</p>
                    </div>
                  ) : (data?.recentOrders ?? []).map(o => (
                    <div key={o.id} className="bg-white/4 border border-white/8 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-black">{o.display_id}</p>
                          <p className="text-zinc-500 text-xs mt-0.5">{o.customer_name}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${STATUS_COLORS[o.status] ?? "text-zinc-400 bg-white/5"}`}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                          <span className="uppercase font-bold">{o.payment_method}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {o.pod_photo_url && (
                            <button onClick={() => setPodLightbox(o.pod_photo_url!)} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-bold">
                              <Camera size={10} /> POD
                            </button>
                          )}
                          <p className="text-white font-bold text-sm">₹{(o.total_amount_paise / 100).toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DOCUMENTS */}
              {tab === "docs" && (
                <div className="space-y-4">
                  {!data?.documents ? (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                      <FileText size={32} className="mb-2" />
                      <p className="text-sm font-bold">No documents submitted</p>
                    </div>
                  ) : (
                    <>
                      {/* Status */}
                      {(() => {
                        const st = data.documents.doc_review_status;
                        const cfgs: Record<string, { cls: string; icon: any; label: string }> = {
                          pending:  { cls: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", icon: Clock, label: "Pending Review" },
                          approved: { cls: "bg-green-500/10 border-green-500/20 text-green-400",   icon: CheckCircle2, label: "Approved" },
                          rejected: { cls: "bg-red-500/10 border-red-500/20 text-red-400",         icon: XCircle, label: "Rejected" },
                        };
                        const cfg = cfgs[st] ?? cfgs.pending;
                        const Icon = cfg.icon;
                        return (
                          <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.cls}`}>
                            <Icon size={18} />
                            <div>
                              <p className="font-bold text-sm">{cfg.label}</p>
                              {data.documents.doc_review_reason && <p className="text-xs opacity-70 mt-0.5">{data.documents.doc_review_reason}</p>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Photo */}
                      {data.documents.id_photo_url && (
                        <div
                          className="rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-white/30 transition-all"
                          onClick={() => setPodLightbox(data.documents!.id_photo_url!)}
                        >
                          <img src={data.documents.id_photo_url} alt="ID Document" className="w-full h-48 object-cover" />
                          <p className="text-center text-xs text-zinc-500 py-2 bg-white/3 font-medium">Tap to enlarge</p>
                        </div>
                      )}

                      {/* Fields */}
                      <div className="bg-white/4 border border-white/8 rounded-xl p-4 space-y-3">
                        {[
                          { icon: Car, label: "Vehicle", value: data.documents.vehicle_type ? data.documents.vehicle_type.charAt(0).toUpperCase() + data.documents.vehicle_type.slice(1) : "—" },
                          { icon: FileText, label: "License No.", value: data.documents.license_number || "—" },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <row.icon size={14} className="text-zinc-500" />
                            <span className="text-xs text-zinc-500 w-24">{row.label}</span>
                            <span className="text-sm text-white font-mono">{row.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        {data.documents.doc_review_status !== "approved" && (
                          <button
                            onClick={() => docReviewMutation.mutate({ action: "approve" })}
                            disabled={docReviewMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-bold text-sm hover:bg-green-500/25 transition-all disabled:opacity-40"
                          >
                            <CheckCircle2 size={15} /> Approve
                          </button>
                        )}
                        {data.documents.doc_review_status !== "rejected" && (
                          <button
                            onClick={() => {
                              const reason = prompt("Rejection reason:");
                              if (reason) docReviewMutation.mutate({ action: "reject", reason });
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all"
                          >
                            <XCircle size={15} /> Reject
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* POD / Doc lightbox */}
      {podLightbox && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setPodLightbox(null)}>
          <img src={podLightbox} alt="Document" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
