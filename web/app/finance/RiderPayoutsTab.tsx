"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, X, AlertTriangle, RotateCcw, ShieldCheck, Banknote } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function PayModal({ open, payout, onConfirm, onClose }: any) {
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      await onConfirm(payout.id, ref, notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open || !payout) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Transfer Payment</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
          <div className="text-lg font-black text-white">{payout.rider_name}</div>
          <div className="text-sm text-white/40">{payout.rider_phone}</div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-white/40">Amount</span>
            <span className="text-xl font-black text-emerald-400">{fmt(payout.net_amount_paise)}</span>
          </div>
          {payout.upi_id && (
            <div className="flex justify-between">
              <span className="text-xs text-white/40">UPI</span>
              <span className="text-xs font-mono text-white/70">{payout.upi_id}</span>
            </div>
          )}
          {!payout.upi_id && (
            <div className="text-xs text-amber-400 font-semibold">⚠ No UPI on file — transfer manually then enter reference below</div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Payment Reference (optional if auto)</label>
            <input
              type="text"
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="UPI transaction ID / bank ref"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes..."
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/20"
            />
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
        >
          {loading ? "Transferring..." : `Transfer ${fmt(payout.net_amount_paise)}`}
        </button>
      </motion.div>
    </div>
  );
}

type View = "pending" | "approved" | "paid" | "failed" | "riders";

export function RiderPayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("pending");
  const [paying, setPaying] = useState<any>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "riders") {
        const res = await api.get("/finance/rider-payouts/all-riders");
        setRiders(res.riders || []);
      } else {
        const res = await api.get(`/finance/rider-payouts?status=${view}`);
        setPayouts(res.payouts || []);
      }
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { load(); }, [load]);
  useSocketRefresh(["rider_payout_updated"], load);

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      await api.post(`/finance/rider-payouts/${id}/approve`, {});
      toast.success("Payout approved — move to Approved tab to transfer");
      await load();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setApproving(null);
    }
  };

  const handlePay = async (id: string, paymentReference: string, notes: string) => {
    const res = await api.post(`/finance/rider-payouts/${id}/pay`, { paymentReference, notes });
    if (res.autoTransferred) {
      toast.success(`Transferred via Razorpay${res.payout?.utr_number ? ` · UTR ${res.payout.utr_number}` : ""}`);
    } else if (res.autoSkipReason === "rider_has_no_upi") {
      toast.warning("Marked paid — no UPI on file, ensure manual transfer was done");
    } else if (res.autoSkipReason === "razorpay_not_configured") {
      toast.warning("Marked paid — Razorpay not configured, ensure manual transfer was done");
    } else if (res.autoSkipReason) {
      toast.warning(`Marked paid — auto-transfer failed: ${res.autoSkipReason}`);
    } else {
      toast.success("Payment recorded");
    }
    await load();
  };

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await api.post(`/finance/rider-payouts/${id}/retry`, {});
      toast.success("Reset to pending — approve and pay to reprocess");
      setView("pending");
      await load();
    } catch {
      toast.error("Failed to retry");
    } finally {
      setRetrying(null);
    }
  };

  const totalPending = view === "pending" ? payouts.reduce((s, p) => s + parseInt(p.net_amount_paise), 0) : 0;
  const totalApproved = view === "approved" ? payouts.reduce((s, p) => s + parseInt(p.net_amount_paise), 0) : 0;

  const TAB_LABELS: Record<View, string> = {
    pending: "Pending Review",
    approved: "Approved",
    paid: "Paid",
    failed: "Failed",
    riders: "All Riders",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Rider Payouts</h2>
          <p className="text-white/40 text-sm mt-0.5">Review → Approve → Transfer</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Two-step flow legend */}
      <div className="flex items-center gap-3 text-xs text-white/30 bg-white/[0.03] rounded-xl px-4 py-3">
        <span className="font-bold text-indigo-400">1. Review</span>
        <span>→</span>
        <span className="font-bold text-indigo-400">Approve</span>
        <span>→</span>
        <span className="font-bold text-emerald-400">2. Transfer money</span>
        <span className="ml-auto">No money moves until step 2</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "paid", "failed", "riders"] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              view === v
                ? v === "failed" ? "bg-red-500/80 text-white"
                  : v === "approved" ? "bg-emerald-500 text-white"
                  : "bg-indigo-500 text-white"
                : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}
          >
            {TAB_LABELS[v]}
          </button>
        ))}
      </div>

      {view === "pending" && totalPending > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-indigo-400">Awaiting Review</div>
            <div className="text-xs text-white/30">{payouts.length} requests — approve each before transferring</div>
          </div>
          <div className="text-2xl font-black text-indigo-400">{fmt(totalPending)}</div>
        </div>
      )}

      {view === "approved" && totalApproved > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-emerald-400">Ready to Transfer</div>
            <div className="text-xs text-white/30">{payouts.length} approved — click Transfer to send money</div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{fmt(totalApproved)}</div>
        </div>
      )}

      {view === "failed" && payouts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-red-400">{payouts.length} failed payout{payouts.length !== 1 ? "s" : ""}</div>
            <div className="text-xs text-white/30">Retry to reset to pending, then approve and transfer again</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : view === "riders" ? (
        <div className="space-y-3">
          {riders.map((r: any) => (
            <div key={r.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm">{r.name}</div>
                <div className="text-xs text-white/30">{r.phone} · {r.total_deliveries} deliveries · {fmt(parseInt(r.total_earned_paise))} earned (7d)</div>
              </div>
              <div className="text-right">
                {parseInt(r.pending_paise) > 0 ? (
                  <>
                    <div className="text-sm font-black text-indigo-400">{fmt(parseInt(r.pending_paise))}</div>
                    <div className="text-xs text-white/30">pending payout</div>
                  </>
                ) : (
                  <div className="text-xs text-emerald-400 font-bold">All settled</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40" />
          <p className="text-white/30 text-sm">No {TAB_LABELS[view].toLowerCase()} payouts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p: any) => (
            <div
              key={p.id}
              className={`bg-[#0d0d1a] rounded-2xl p-4 border ${
                view === "failed" ? "border-red-500/20"
                : view === "approved" ? "border-emerald-500/20"
                : "border-white/[0.07]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-white flex items-center gap-2">
                    {p.rider_name}
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                      p.payout_type === "salary_monthly" ? "bg-blue-500/10 text-blue-400"
                      : p.payout_type === "withdrawal_request" ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {p.payout_type === "salary_monthly" ? "Salary" : p.payout_type === "withdrawal_request" ? "Withdrawal" : "Gig"}
                    </span>
                  </div>
                  <div className="text-xs text-white/30">{p.rider_phone}</div>
                  <div className="text-xs text-white/30 mt-1">
                    {new Date(p.week_start).toLocaleDateString("en-IN")} → {new Date(p.week_end).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <div className={`text-xl font-black ${
                    view === "failed" ? "text-red-400"
                    : view === "approved" ? "text-emerald-400"
                    : "text-indigo-400"
                  }`}>
                    {fmt(parseInt(p.net_amount_paise))}
                  </div>
                  {p.upi_id && <div className="text-xs font-mono text-white/30">{p.upi_id}</div>}

                  {view === "pending" && (
                    <button
                      onClick={() => handleApprove(p.id)}
                      disabled={approving === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className={`w-3 h-3 ${approving === p.id ? "animate-pulse" : ""}`} />
                      {approving === p.id ? "Approving..." : "Approve"}
                    </button>
                  )}

                  {view === "approved" && (
                    <button
                      onClick={() => setPaying(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors"
                    >
                      <Banknote className="w-3 h-3" />
                      Transfer
                    </button>
                  )}

                  {view === "paid" && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">
                        {p.payout_mode === "auto" ? "Auto · " : ""}
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-IN") : "Paid"}
                      </span>
                    </div>
                  )}

                  {view === "failed" && (
                    <button
                      onClick={() => handleRetry(p.id)}
                      disabled={retrying === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3 h-3 ${retrying === p.id ? "animate-spin" : ""}`} />
                      Retry
                    </button>
                  )}
                </div>
              </div>

              {view === "failed" && p.failure_reason && (
                <div className="mt-3 pt-3 border-t border-red-500/10 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-red-400/70">{p.failure_reason}</span>
                </div>
              )}

              {view === "paid" && (p.payment_reference || p.utr_number) && (
                <div className="mt-3 pt-3 border-t border-white/[0.05] text-xs text-white/30 flex gap-4">
                  {p.payment_reference && <span>Ref: <span className="font-mono text-white/50">{p.payment_reference}</span></span>}
                  {p.utr_number && <span>UTR: <span className="font-mono text-white/50">{p.utr_number}</span></span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {paying && (
          <PayModal
            open={!!paying}
            payout={paying}
            onConfirm={handlePay}
            onClose={() => setPaying(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
