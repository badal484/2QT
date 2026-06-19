"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, Utensils, X, Plus, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

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

function MarkPaidModal({ open, payout, onConfirm, onClose }: any) {
  const [upiRef, setUpiRef] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      await onConfirm(payout.id, upiRef, bankRef, notes);
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
          <h3 className="text-lg font-black text-white">Mark Kitchen Paid</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4 space-y-2">
          <div className="text-lg font-black text-white">{payout.kitchen_name}</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-center">
              <div className="text-xs text-white/30">Gross Sales</div>
              <div className="text-sm font-black text-white">{fmt(payout.gross_sales_paise)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/30">Commission</div>
              <div className="text-sm font-black text-red-400">- {fmt(payout.commission_paise)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/30">Net Payout</div>
              <div className="text-sm font-black text-pink-400">{fmt(payout.net_payout_paise)}</div>
            </div>
          </div>
          {payout.upi_id && <div className="text-xs text-white/40 pt-1">UPI: <span className="font-mono">{payout.upi_id}</span></div>}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">UPI Reference</label>
            <input type="text" value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="UPI transaction ID"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50 placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Bank Reference</label>
            <input type="text" value={bankRef} onChange={e => setBankRef(e.target.value)} placeholder="Bank transfer ref (optional)"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50 placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50 placeholder:text-white/20" />
          </div>
        </div>
        <button onClick={confirm} disabled={loading}
          className="w-full py-3.5 rounded-xl bg-pink-500 text-white font-black text-sm hover:bg-pink-400 transition-colors disabled:opacity-50">
          {loading ? "Processing..." : `Confirm Payment — ${fmt(payout.net_payout_paise)}`}
        </button>
      </motion.div>
    </div>
  );
}

export function KitchenPayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"pending" | "paid" | "summary">("summary");
  const [showGenerate, setShowGenerate] = useState(false);
  const [markPaying, setMarkPaying] = useState<any>(null);

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

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async (kitchenId: string, periodStart: string, periodEnd: string) => {
    try {
      const res = await api.post("/finance/kitchen-payouts/generate", { kitchenId, periodStart, periodEnd });
      toast.success(`Payout generated: ${fmt(res.payout.net_payout_paise)}`);
      setView("pending");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    }
  };

  const handleMarkPaid = async (id: string, upiReference: string, bankReference: string, notes: string) => {
    try {
      await api.post(`/finance/kitchen-payouts/${id}/mark-paid`, { upiReference, bankReference, notes });
      toast.success("Kitchen payout marked as paid");
      await load();
    } catch {
      toast.error("Failed to mark paid");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Kitchen Payouts</h2>
          <p className="text-white/40 text-sm mt-0.5">Commission deduction + partner payouts</p>
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

      <div className="flex gap-2">
        {(["summary", "pending", "paid"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              view === v ? "bg-pink-500 text-white" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}>
            {v}
          </button>
        ))}
      </div>

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
              {(parseInt(k.lifetime_gross_paise) > 0) && (
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
          <p className="text-white/30 text-sm">No {view} kitchen payouts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p: any) => (
            <div key={p.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-white">{p.kitchen_name}</div>
                  <div className="text-xs text-white/30">
                    {new Date(p.period_start).toLocaleDateString("en-IN")} → {new Date(p.period_end).toLocaleDateString("en-IN")} · {p.orders_count} orders
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-lg font-black text-pink-400">{fmt(parseInt(p.net_payout_paise))}</div>
                  {view === "pending" && (
                    <button onClick={() => setMarkPaying(p)}
                      className="px-3 py-1.5 rounded-lg bg-pink-500 text-white text-xs font-bold hover:bg-pink-400 transition-colors">
                      Mark Paid
                    </button>
                  )}
                  {view === "paid" && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">Paid</span>
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
              {p.upi_reference && (
                <div className="mt-2 text-xs text-white/30 pt-2 border-t border-white/[0.04]">
                  UPI Ref: <span className="font-mono text-white/50">{p.upi_reference}</span>
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
        {markPaying && (
          <MarkPaidModal open={!!markPaying} payout={markPaying} onConfirm={handleMarkPaid} onClose={() => setMarkPaying(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
