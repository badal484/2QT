"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, X, Plus, ShieldCheck, Banknote } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

function GenerateModal({ open, kitchens, onGenerate, onClose }: any) {
  const [kitchenId, setKitchenId] = useState("");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!kitchenId) return toast.error("Select a kitchen");
    setLoading(true);
    try {
      await onGenerate(kitchenId, periodStart, periodEnd);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Generate Kitchen Payout</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Partner Kitchen</label>
            <select
              value={kitchenId}
              onChange={e => setKitchenId(e.target.value)}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50"
            >
              <option value="">Select kitchen...</option>
              {kitchens.map((k: any) => (
                <option key={k.id} value={k.id}>{k.kitchen_name} ({pct(k.commission_rate)} commission)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Period Start</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Period End</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/50" />
            </div>
          </div>
        </div>

        <button onClick={confirm} disabled={loading}
          className="w-full py-3.5 rounded-xl bg-pink-500 text-white font-black text-sm hover:bg-pink-400 transition-colors disabled:opacity-50">
          {loading ? "Calculating..." : "Generate Payout"}
        </button>
      </motion.div>
    </div>
  );
}

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
          <h3 className="text-lg font-black text-white">Transfer to Kitchen</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4 space-y-2">
          <div className="text-lg font-black text-white">{payout.kitchen_name}</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-center">
              <div className="text-xs text-white/30">Gross Sales</div>
              <div className="text-sm font-black text-white">{fmt(parseInt(payout.gross_sales_paise))}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/30">Commission</div>
              <div className="text-sm font-black text-red-400">- {fmt(parseInt(payout.commission_paise))}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/30">Net Payout</div>
              <div className="text-sm font-black text-pink-400">{fmt(parseInt(payout.net_payout_paise))}</div>
            </div>
          </div>
          {payout.upi_id && (
            <div className="text-xs text-white/40 pt-1">UPI: <span className="font-mono">{payout.upi_id}</span></div>
          )}
          {!payout.upi_id && (
            <div className="text-xs text-amber-400 font-semibold">⚠ No UPI on file — transfer manually then enter reference below</div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Payment Reference (optional if auto)</label>
            <input type="text" value={ref} onChange={e => setRef(e.target.value)} placeholder="UPI transaction ID / bank ref"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50 placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..."
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50 placeholder:text-white/20" />
          </div>
        </div>

        <button onClick={confirm} disabled={loading}
          className="w-full py-3.5 rounded-xl bg-pink-500 text-white font-black text-sm hover:bg-pink-400 transition-colors disabled:opacity-50">
          {loading ? "Transferring..." : `Transfer ${fmt(parseInt(payout.net_payout_paise))}`}
        </button>
      </motion.div>
    </div>
  );
}

type View = "summary" | "pending" | "approved" | "paid";

export function KitchenPayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("summary");
  const [showGenerate, setShowGenerate] = useState(false);
  const [paying, setPaying] = useState<any>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "summary") {
        const res = await api.get("/finance/kitchen-payouts/summary");
        setSummary(res.kitchens || []);
      } else {
        const res = await api.get(`/finance/kitchen-payouts?status=${view}`);
        setPayouts(res.payouts || []);
      }
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view]);

  // Keep summary fresh for GenerateModal's kitchen list
  useEffect(() => {
    if (view !== "summary") {
      api.get("/finance/kitchen-payouts/summary").then(r => setSummary(r.kitchens || [])).catch(() => {});
    }
  }, [view]);

  useEffect(() => { load(); }, [load]);
  useSocketRefresh(["kitchen_payout_updated"], load);

  const handleGenerate = async (kitchenId: string, periodStart: string, periodEnd: string) => {
    try {
      const res = await api.post("/finance/kitchen-payouts/generate", { kitchenId, periodStart, periodEnd });
      toast.success(`Payout generated: ${fmt(res.payout.net_payout_paise)} — approve it in the Pending tab`);
      setView("pending");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    }
  };

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      await api.post(`/finance/kitchen-payouts/${id}/approve`, {});
      toast.success("Payout approved — move to Approved tab to transfer");
      await load();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setApproving(null);
    }
  };

  const handlePay = async (id: string, paymentReference: string, notes: string) => {
    const res = await api.post(`/finance/kitchen-payouts/${id}/pay`, { paymentReference, notes });
    if (res.autoTransferred) {
      toast.success(`Transferred via Razorpay${res.payout?.utr_number ? ` · UTR ${res.payout.utr_number}` : ""}`);
    } else if (res.autoSkipReason === "kitchen_has_no_upi") {
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

  const TAB_LABELS: Record<View, string> = {
    summary: "All Kitchens",
    pending: "Pending Review",
    approved: "Approved",
    paid: "Paid",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Kitchen Payouts</h2>
          <p className="text-white/40 text-sm mt-0.5">Generate → Approve → Transfer</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500 text-white text-sm font-bold hover:bg-pink-400 transition-colors">
            <Plus className="w-4 h-4" /> Generate Payout
          </button>
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Flow legend */}
      <div className="flex items-center gap-3 text-xs text-white/30 bg-white/[0.03] rounded-xl px-4 py-3">
        <span className="font-bold text-pink-400">1. Generate</span>
        <span>→</span>
        <span className="font-bold text-indigo-400">2. Approve</span>
        <span>→</span>
        <span className="font-bold text-emerald-400">3. Transfer money</span>
        <span className="ml-auto">No money moves until step 3</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["summary", "pending", "approved", "paid"] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              view === v
                ? v === "approved" ? "bg-emerald-500 text-white"
                  : "bg-pink-500 text-white"
                : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}>
            {TAB_LABELS[v]}
          </button>
        ))}
      </div>

      {view === "approved" && payouts.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-emerald-400">Ready to Transfer</div>
            <div className="text-xs text-white/30">{payouts.length} approved — click Transfer to send money to kitchens</div>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {fmt(payouts.reduce((s, p) => s + parseInt(p.net_payout_paise), 0))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : view === "summary" ? (
        <div className="space-y-3">
          {summary.length === 0 ? (
            <p className="text-white/30 text-sm py-8 text-center">No partner kitchens yet.</p>
          ) : summary.map((k: any) => (
            <div key={k.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-white">{k.kitchen_name}</div>
                  <div className="text-xs text-white/30">Commission: {pct(k.commission_rate)} · {k.orders_last_7_days} orders (7d)</div>
                </div>
                {parseInt(k.pending_payout_paise) > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-white/30">Pending payout</div>
                    <div className="text-lg font-black text-pink-400">{fmt(parseInt(k.pending_payout_paise))}</div>
                  </div>
                )}
              </div>
              {parseInt(k.lifetime_gross_paise) > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.05]">
                  <div>
                    <div className="text-xs text-white/30">Lifetime Sales</div>
                    <div className="text-sm font-bold text-white">{fmt(parseInt(k.lifetime_gross_paise))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/30">Commission Earned</div>
                    <div className="text-sm font-bold text-emerald-400">{fmt(parseInt(k.lifetime_commission_paise))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/30">Paid Out</div>
                    <div className="text-sm font-bold text-white">{fmt(parseInt(k.lifetime_gross_paise) - parseInt(k.lifetime_commission_paise))}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40" />
          <p className="text-white/30 text-sm">No {TAB_LABELS[view].toLowerCase()} kitchen payouts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p: any) => (
            <div key={p.id} className={`bg-[#0d0d1a] rounded-2xl p-4 border ${
              view === "approved" ? "border-emerald-500/20" : "border-white/[0.07]"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-white">{p.kitchen_name}</div>
                  <div className="text-xs text-white/30">
                    {new Date(p.period_start).toLocaleDateString("en-IN")} → {new Date(p.period_end).toLocaleDateString("en-IN")} · {p.orders_count} orders
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div className={`text-lg font-black ${view === "approved" ? "text-emerald-400" : "text-pink-400"}`}>
                    {fmt(parseInt(p.net_payout_paise))}
                  </div>

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
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.05]">
                <div>
                  <div className="text-xs text-white/30">Gross Sales</div>
                  <div className="text-sm font-bold text-white">{fmt(parseInt(p.gross_sales_paise))}</div>
                </div>
                <div>
                  <div className="text-xs text-white/30">2QT Commission</div>
                  <div className="text-sm font-bold text-emerald-400">{fmt(parseInt(p.commission_paise))}</div>
                </div>
                <div>
                  <div className="text-xs text-white/30">Kitchen Gets</div>
                  <div className="text-sm font-bold text-pink-400">{fmt(parseInt(p.net_payout_paise))}</div>
                </div>
              </div>

              {view === "paid" && (p.payment_reference || p.utr_number) && (
                <div className="mt-2 pt-2 border-t border-white/[0.04] text-xs text-white/30 flex gap-4">
                  {p.payment_reference && <span>Ref: <span className="font-mono text-white/50">{p.payment_reference}</span></span>}
                  {p.utr_number && <span>UTR: <span className="font-mono text-white/50">{p.utr_number}</span></span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showGenerate && (
          <GenerateModal open={showGenerate} kitchens={summary} onGenerate={handleGenerate} onClose={() => setShowGenerate(false)} />
        )}
        {paying && (
          <PayModal open={!!paying} payout={paying} onConfirm={handlePay} onClose={() => setPaying(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
