"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Building2, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, IndianRupee } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

type RefundStatus = "pending" | "processing" | "processed" | "failed";

interface Refund {
  id: string;
  order_id: string;
  order_display_id: string;
  customer_name: string;
  customer_phone: string;
  amount_paise: number;
  refund_type: "wallet" | "bank";
  reason: string;
  status: RefundStatus;
  complaint_type?: string;
  initiated_by_name?: string;
  approved_by_name?: string;
  razorpay_payment_id?: string;
  razorpay_refund_id?: string;
  failure_reason?: string;
  created_at: string;
  processed_at?: string;
}

interface Counts {
  pending: string;
  processing: string;
  processed: string;
  failed: string;
  pending_paise: string;
  processed_paise: string;
}

const STATUS_TABS: { key: RefundStatus | "all"; label: string }[] = [
  { key: "pending",    label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "failed",     label: "Failed" },
  { key: "processed",  label: "History" },
];

function paise(p: number) {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

function StatusPill({ status }: { status: RefundStatus }) {
  const map: Record<RefundStatus, { color: string; icon: React.ReactNode; label: string }> = {
    pending:    { color: "bg-amber-500/15 text-amber-400 border-amber-500/30",    icon: <Clock className="w-3 h-3" />,         label: "Pending" },
    processing: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30",       icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: "Processing" },
    processed:  { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" />, label: "Processed" },
    failed:     { color: "bg-red-500/15 text-red-400 border-red-500/30",          icon: <XCircle className="w-3 h-3" />,        label: "Failed" },
  };
  const { color, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${color}`}>
      {icon} {label}
    </span>
  );
}

export function RefundsTab() {
  const [activeTab, setActiveTab] = useState<RefundStatus | "all">("pending");
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/finance/refunds${activeTab !== "all" ? `?status=${activeTab}` : ""}`);
      setRefunds(res.refunds || []);
      if (res.counts) setCounts(res.counts);
    } catch (e: any) {
      toast.error(e.message || "Failed to load refunds");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);
  useSocketRefresh(["refund_updated", "order_status_update"], load);

  const handleProcess = async (refundId: string, refundType: "wallet" | "bank") => {
    setProcessing(refundId);
    try {
      await api.post(`/finance/refunds/${refundId}/process`, { refundType });
      toast.success(
        refundType === "bank"
          ? "Bank refund initiated via Razorpay — customer gets money in 5–7 days"
          : "Wallet refund processed — customer wallet credited instantly"
      );
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to process refund");
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = parseInt(counts?.pending || "0");
  const failedCount  = parseInt(counts?.failed  || "0");

  return (
    <div className="p-8 space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Refund Queue</h2>
          <p className="text-zinc-400 font-medium">Review and approve customer refunds. Choose wallet (instant) or bank (5–7 days).</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards */}
      {counts && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#11111a] border border-amber-500/20 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">Pending Approval</p>
            <p className="text-3xl font-black text-white">{counts.pending}</p>
            <p className="text-sm text-zinc-500 mt-1">{paise(parseInt(counts.pending_paise))} to process</p>
          </div>
          <div className="bg-[#11111a] border border-blue-500/20 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Processing</p>
            <p className="text-3xl font-black text-white">{counts.processing}</p>
            <p className="text-sm text-zinc-500 mt-1">Awaiting Razorpay</p>
          </div>
          <div className="bg-[#11111a] border border-red-500/20 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-1">Failed</p>
            <p className="text-3xl font-black text-white">{counts.failed}</p>
            <p className="text-sm text-zinc-500 mt-1">Need retry</p>
          </div>
          <div className="bg-[#11111a] border border-emerald-500/20 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">Total Refunded</p>
            <p className="text-3xl font-black text-white">{paise(parseInt(counts.processed_paise))}</p>
            <p className="text-sm text-zinc-500 mt-1">{counts.processed} completed</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all relative
              ${activeTab === tab.key
                ? "text-white bg-white/[0.06] border border-b-0 border-white/[0.08]"
                : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && (
              <span className="ml-2 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
            {tab.key === "failed" && failedCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{failedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Refund list */}
      {loading ? (
        <div className="py-16 text-center text-zinc-500 animate-pulse font-medium">Loading refunds…</div>
      ) : refunds.length === 0 ? (
        <div className="py-20 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-50" />
          <p className="text-zinc-400 font-semibold">No refunds in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map(r => (
            <div key={r.id} className={`bg-[#11111a] border rounded-2xl p-5 transition-all
              ${r.status === "pending" ? "border-amber-500/20" :
                r.status === "failed"  ? "border-red-500/20" :
                r.status === "processing" ? "border-blue-500/20" : "border-white/[0.05]"}`}>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Top row */}
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <StatusPill status={r.status} />
                    <span className="text-xs font-bold text-zinc-500 font-mono">#{r.order_display_id}</span>
                    {r.complaint_type && (
                      <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                        Complaint: {r.complaint_type.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">{timeAgo(r.created_at)}</span>
                  </div>

                  {/* Customer + amount */}
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-2xl font-black text-white">{paise(r.amount_paise)}</span>
                    <span className="text-sm text-zinc-400">{r.customer_name} · {r.customer_phone}</span>
                  </div>

                  {/* Reason */}
                  {r.reason && (
                    <p className="text-sm text-zinc-500 mb-2 line-clamp-1">Reason: {r.reason}</p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                    {r.initiated_by_name && <span>Raised by: <span className="text-zinc-400">{r.initiated_by_name}</span></span>}
                    {r.approved_by_name  && <span>Approved by: <span className="text-zinc-400">{r.approved_by_name}</span></span>}
                    {r.razorpay_refund_id && <span>Rzp: <span className="text-zinc-400 font-mono">{r.razorpay_refund_id}</span></span>}
                    {r.processed_at && <span>Processed: <span className="text-zinc-400">{timeAgo(r.processed_at)}</span></span>}
                  </div>

                  {/* Failure reason */}
                  {r.status === "failed" && r.failure_reason && (
                    <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-400">{r.failure_reason}</p>
                    </div>
                  )}

                  {/* Refund type badge (history) */}
                  {r.status === "processed" && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      {r.refund_type === "bank"
                        ? <><Building2 className="w-3.5 h-3.5" /> Bank refund</>
                        : <><Wallet className="w-3.5 h-3.5" /> Wallet credit</>}
                    </div>
                  )}
                </div>

                {/* Action buttons — only for pending/failed */}
                {(r.status === "pending" || r.status === "failed") && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      disabled={processing === r.id}
                      onClick={() => handleProcess(r.id, "wallet")}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
                    >
                      <Wallet className="w-4 h-4" />
                      Wallet (instant)
                    </button>
                    <button
                      disabled={processing === r.id || !r.razorpay_payment_id}
                      onClick={() => handleProcess(r.id, "bank")}
                      title={!r.razorpay_payment_id ? "No Razorpay payment ID — use wallet refund" : ""}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
                    >
                      <Building2 className="w-4 h-4" />
                      Bank (5–7 days)
                    </button>
                  </div>
                )}

                {/* Processing indicator */}
                {r.status === "processing" && (
                  <div className="shrink-0 text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                    <p className="text-xs text-zinc-500">Via Razorpay</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
