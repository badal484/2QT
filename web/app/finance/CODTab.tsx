"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, AlertCircle, Wallet, X, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function ConfirmModal({ open, rider, orders, onConfirm, onClose }: any) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const totalPaise = orders.reduce((s: number, o: any) => s + parseInt(o.total_amount_paise), 0);

  const confirm = async () => {
    setLoading(true);
    try {
      await onConfirm(orders.map((o: any) => o.id), rider.rider_id, notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Mark Cash Collected</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="text-sm text-white/60">Collecting from</div>
          <div className="text-lg font-black text-white mt-1">{rider?.rider_name}</div>
          <div className="text-sm text-white/40">{rider?.rider_phone}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-white/40">{orders.length} orders</span>
            <span className="text-2xl font-black text-amber-400">{fmt(totalPaise)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Collected at kitchen at 7pm"
            className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/20"
          />
        </div>

        <button
          onClick={confirm}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
        >
          {loading ? "Confirming..." : `Confirm — ${fmt(totalPaise)} Collected`}
        </button>
      </motion.div>
    </div>
  );
}

export function CODTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmRider, setConfirmRider] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/finance/cod/pending");
      setOrders(res.orders || []);
    } catch {
      toast.error("Failed to load COD orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get("/finance/cod/history?limit=30");
      setHistory(res.collections || []);
    } catch {
      toast.error("Failed to load history");
    }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory]);

  // Group orders by rider
  const byRider = orders.reduce((acc: any, o) => {
    if (!acc[o.rider_id]) acc[o.rider_id] = { rider_id: o.rider_id, rider_name: o.rider_name, rider_phone: o.rider_phone, orders: [] };
    acc[o.rider_id].orders.push(o);
    return acc;
  }, {});

  const riderGroups = Object.values(byRider) as any[];
  const totalPending = orders.reduce((s, o) => s + parseInt(o.total_amount_paise), 0);

  const handleMarkCollected = async (orderIds: string[], riderId: string, notes: string) => {
    try {
      await api.post("/finance/cod/mark-collected", { orderIds, riderId, notes });
      toast.success("Cash marked as collected");
      await load();
    } catch {
      toast.error("Failed to mark collected");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">COD Cash Tracker</h2>
          <p className="text-white/40 text-sm mt-0.5">Cash in transit with riders</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 transition-colors"
          >
            {showHistory ? "Pending" : "History"}
          </button>
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!showHistory ? (
        <>
          {/* Total pending banner */}
          {totalPending > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-sm font-bold text-amber-400">Total Cash In Transit</div>
                  <div className="text-xs text-white/40">{orders.length} unconfirmed COD orders</div>
                </div>
              </div>
              <div className="text-2xl font-black text-amber-400">{fmt(totalPending)}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
            </div>
          ) : riderGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/40" />
              <p className="text-white/30 text-sm">All cash collected. No pending COD.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {riderGroups.map((rg: any) => {
                const riderTotal = rg.orders.reduce((s: number, o: any) => s + parseInt(o.total_amount_paise), 0);
                return (
                  <div key={rg.rider_id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden">
                    {/* Rider header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
                      <div>
                        <div className="font-bold text-white">{rg.rider_name}</div>
                        <div className="text-xs text-white/40">{rg.rider_phone} · {rg.orders.length} orders</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-amber-400">{fmt(riderTotal)}</span>
                        <button
                          onClick={() => setConfirmRider(rg)}
                          className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-colors"
                        >
                          Collect
                        </button>
                      </div>
                    </div>
                    {/* Order list */}
                    <div className="divide-y divide-white/[0.04]">
                      {rg.orders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <span className="text-xs font-mono text-white/60">#{o.display_id}</span>
                            <span className="text-xs text-white/30 ml-3">{new Date(o.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <span className="text-sm font-bold text-white">{fmt(parseInt(o.total_amount_paise))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Collection History</h3>
          {history.length === 0 ? (
            <p className="text-white/30 text-sm py-8 text-center">No collections recorded yet.</p>
          ) : history.map((c: any) => (
            <div key={c.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{c.rider_name}</span>
                  {c.order_display_id && <span className="text-xs text-white/30 font-mono">#{c.order_display_id}</span>}
                </div>
                <div className="text-xs text-white/30 mt-0.5">
                  Collected by {c.collected_by_name} · {new Date(c.created_at).toLocaleString("en-IN")}
                </div>
                {c.notes && <div className="text-xs text-white/40 mt-0.5">{c.notes}</div>}
              </div>
              <span className="text-base font-black text-emerald-400">{fmt(c.amount_paise)}</span>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirmRider && (
          <ConfirmModal
            open={!!confirmRider}
            rider={confirmRider}
            orders={confirmRider?.orders || []}
            onConfirm={handleMarkCollected}
            onClose={() => setConfirmRider(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
