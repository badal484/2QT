"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, Bike, X, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function MarkPaidModal({ open, payout, onConfirm, onClose }: any) {
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
          <h3 className="text-lg font-black text-white">Mark Rider Paid</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-2">
          <div className="text-lg font-black text-white">{payout.rider_name}</div>
          <div className="text-sm text-white/40">{payout.rider_phone}</div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-white/40">Net payout</span>
            <span className="text-xl font-black text-indigo-400">{fmt(payout.net_amount_paise)}</span>
          </div>
          {payout.upi_id && (
            <div className="flex justify-between">
              <span className="text-xs text-white/40">UPI ID</span>
              <span className="text-xs font-mono text-white/70">{payout.upi_id}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Payment Reference</label>
            <input
              type="text"
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="UPI transaction ID / bank ref"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes..."
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 placeholder:text-white/20"
            />
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-indigo-500 text-white font-black text-sm hover:bg-indigo-400 transition-colors disabled:opacity-50"
        >
          {loading ? "Processing..." : `Confirm Payment — ${fmt(payout.net_amount_paise)}`}
        </button>
      </motion.div>
    </div>
  );
}

export function RiderPayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"pending" | "paid" | "riders">("pending");
  const [markPaying, setMarkPaying] = useState<any>(null);

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

  const handleMarkPaid = async (id: string, paymentReference: string, notes: string) => {
    try {
      await api.post(`/finance/rider-payouts/${id}/mark-paid`, { paymentReference, notes });
      toast.success("Payout marked as paid");
      await load();
    } catch {
      toast.error("Failed to mark paid");
    }
  };

  const totalPending = payouts.reduce((s, p) => s + parseInt(p.net_amount_paise), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Rider Payouts</h2>
          <p className="text-white/40 text-sm mt-0.5">Weekly payout management</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        {(["pending", "paid", "riders"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              view === v ? "bg-indigo-500 text-white" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}
          >
            {v === "riders" ? "All Riders" : v}
          </button>
        ))}
      </div>

      {view === "pending" && totalPending > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-indigo-400">Total Pending</div>
            <div className="text-xs text-white/30">{payouts.length} payout requests</div>
          </div>
          <div className="text-2xl font-black text-indigo-400">{fmt(totalPending)}</div>
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
                <div className="text-xs text-white/30">{r.phone} · {r.total_deliveries} deliveries (7d)</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-white">{fmt(parseInt(r.total_earned_paise))}</div>
                {parseInt(r.pending_paise) > 0 && (
                  <div className="text-xs font-bold text-indigo-400">{fmt(parseInt(r.pending_paise))} pending</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40" />
          <p className="text-white/30 text-sm">No {view} payouts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p: any) => (
            <div key={p.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-white">{p.rider_name}</div>
                  <div className="text-xs text-white/30">{p.rider_phone}</div>
                  <div className="text-xs text-white/30 mt-1">
                    Week: {new Date(p.week_start).toLocaleDateString("en-IN")} → {new Date(p.week_end).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-xl font-black text-indigo-400">{fmt(parseInt(p.net_amount_paise))}</div>
                  {p.upi_id && <div className="text-xs font-mono text-white/30">{p.upi_id}</div>}
                  {view === "pending" && (
                    <button
                      onClick={() => setMarkPaying(p)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors"
                    >
                      Mark Paid
                    </button>
                  )}
                  {view === "paid" && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-IN") : "Paid"}</span>
                    </div>
                  )}
                </div>
              </div>
              {p.payment_reference && (
                <div className="mt-3 pt-3 border-t border-white/[0.05] text-xs text-white/30">
                  Ref: <span className="font-mono text-white/50">{p.payment_reference}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {markPaying && (
          <MarkPaidModal
            open={!!markPaying}
            payout={markPaying}
            onConfirm={handleMarkPaid}
            onClose={() => setMarkPaying(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
