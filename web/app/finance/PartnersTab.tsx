"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Store, CheckCircle2, XCircle, Clock, Edit3, X, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const pct = (r: number | string) => `${(parseFloat(String(r)) * 100).toFixed(0)}%`;
const fmt = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

const APP_COLORS: Record<string, { dot: string; text: string; badge: string }> = {
  new: { dot: "bg-yellow-400", text: "text-yellow-400", badge: "bg-yellow-400/10 text-yellow-400" },
  reviewing: { dot: "bg-blue-400", text: "text-blue-400", badge: "bg-blue-400/10 text-blue-400" },
  approved: { dot: "bg-emerald-400", text: "text-emerald-400", badge: "bg-emerald-400/10 text-emerald-400" },
  rejected: { dot: "bg-red-400", text: "text-red-400", badge: "bg-red-400/10 text-red-400" },
};

function ReviewModal({ open, app, onAction, onClose }: any) {
  const [status, setStatus] = useState<"reviewing" | "approved" | "rejected">("reviewing");
  const [rejReason, setRejReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      await onAction(app.id, status, rejReason, notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open || !app) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Review Application</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <div className="text-lg font-black text-white">{app.restaurant_name}</div>
          <div className="text-sm text-white/60">{app.owner_name} · {app.phone}</div>
          <div className="text-sm text-white/40">{app.email}</div>
          <div className="text-xs text-white/30">{app.address}, {app.city}</div>
          {app.cuisine_type && <div className="text-xs text-white/40">Cuisine: {app.cuisine_type}</div>}
          {app.fssai_number && <div className="text-xs text-white/40">FSSAI: <span className="font-mono">{app.fssai_number}</span></div>}
          {app.expected_daily_orders && <div className="text-xs text-white/40">Exp. daily orders: {app.expected_daily_orders}</div>}
          {app.upi_id && <div className="text-xs text-white/40">UPI: <span className="font-mono">{app.upi_id}</span></div>}
        </div>

        <div>
          <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Action</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(["reviewing", "approved", "rejected"] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                  status === s
                    ? s === "approved" ? "bg-emerald-500 text-white" : s === "rejected" ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {status === "rejected" && (
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Rejection Reason</label>
            <input type="text" value={rejReason} onChange={e => setRejReason(e.target.value)} placeholder="Reason for rejection..."
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50 placeholder:text-white/20" />
          </div>
        )}

        <div>
          <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Internal Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes for the team..."
            className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20 resize-none" />
        </div>

        <button onClick={confirm} disabled={loading}
          className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-black text-sm hover:bg-purple-400 transition-colors disabled:opacity-50">
          {loading ? "Saving..." : "Save Review"}
        </button>
      </motion.div>
    </div>
  );
}

function EditKitchenModal({ open, kitchen, onSave, onClose }: any) {
  const [rate, setRate] = useState(kitchen ? String(Math.round(parseFloat(kitchen.commission_rate) * 100)) : "20");
  const [upiId, setUpiId] = useState(kitchen?.upi_id || "");
  const [bankAccount, setBankAccount] = useState(kitchen?.bank_account || "");
  const [ifsc, setIfsc] = useState(kitchen?.ifsc || "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const rateNum = parseFloat(rate) / 100;
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 1) return toast.error("Commission rate must be 0–100%");
    setLoading(true);
    try {
      await onSave(kitchen.id, { commissionRate: rateNum, upiId, bankAccount, ifsc });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open || !kitchen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Edit Partner — {kitchen.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Commission Rate (%)</label>
            <div className="flex items-center gap-2 mt-2">
              <input type="number" min="0" max="100" step="1" value={rate} onChange={e => setRate(e.target.value)}
                className="w-24 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50" />
              <span className="text-sm text-white/40">% of food subtotal per order</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">UPI ID</label>
            <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="kitchen@upi"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Bank Account</label>
            <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Account number"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">IFSC Code</label>
            <input type="text" value={ifsc} onChange={e => setIfsc(e.target.value)} placeholder="IFSC code"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20" />
          </div>
        </div>
        <button onClick={save} disabled={loading}
          className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-black text-sm hover:bg-purple-400 transition-colors disabled:opacity-50">
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </motion.div>
    </div>
  );
}

export function PartnersTab() {
  const [view, setView] = useState<"applications" | "kitchens">("applications");
  const [appStatus, setAppStatus] = useState<"new" | "reviewing" | "approved" | "rejected">("new");
  const [applications, setApplications] = useState<any[]>([]);
  const [kitchens, setKitchens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "applications") {
        const res = await api.get(`/finance/partners/applications?status=${appStatus}`);
        setApplications(res.applications || []);
      } else {
        const res = await api.get("/finance/partners/kitchens");
        setKitchens(res.kitchens || []);
      }
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view, appStatus]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id: string, status: string, rejectionReason: string, notes: string) => {
    try {
      await api.patch(`/finance/partners/applications/${id}`, { status, rejectionReason, notes });
      toast.success("Application updated");
      await load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleEditKitchen = async (id: string, data: any) => {
    try {
      await api.patch(`/finance/partners/kitchens/${id}`, data);
      toast.success("Kitchen updated");
      await load();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Kitchen Partners</h2>
          <p className="text-white/40 text-sm mt-0.5">Applications + active partner management</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex gap-2">
        {(["applications", "kitchens"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              view === v ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}>
            {v === "kitchens" ? "Active Partners" : "Applications"}
          </button>
        ))}
      </div>

      {view === "applications" && (
        <div className="flex gap-2 flex-wrap">
          {(["new", "reviewing", "approved", "rejected"] as const).map(s => {
            const c = APP_COLORS[s];
            return (
              <button key={s} onClick={() => setAppStatus(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  appStatus === s ? c.badge : "bg-white/5 text-white/30 hover:text-white/60"
                }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${appStatus === s ? c.dot : "bg-white/20"}`} />
                {s}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : view === "applications" ? (
        applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Store className="w-10 h-10 text-white/10" />
            <p className="text-white/30 text-sm">No {appStatus} applications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((a: any) => {
              const c = APP_COLORS[a.status];
              return (
                <div key={a.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white">{a.restaurant_name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${c.badge}`}>{a.status}</span>
                      </div>
                      <div className="text-sm text-white/50">{a.owner_name} · {a.phone}</div>
                      <div className="text-xs text-white/30">{a.city} {a.cuisine_type ? `· ${a.cuisine_type}` : ""}</div>
                      <div className="text-xs text-white/20">{new Date(a.created_at).toLocaleDateString("en-IN")}</div>
                      {a.notes && <div className="text-xs text-white/40 italic mt-1">{a.notes}</div>}
                      {a.rejection_reason && <div className="text-xs text-red-400 mt-1">{a.rejection_reason}</div>}
                    </div>
                    {(a.status === "new" || a.status === "reviewing") && (
                      <button onClick={() => setReviewing(a)}
                        className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-400 transition-colors whitespace-nowrap">
                        Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        kitchens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Store className="w-10 h-10 text-white/10" />
            <p className="text-white/30 text-sm">No partner kitchens yet. Approve an application first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {kitchens.map((k: any) => (
              <div key={k.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white">{k.name}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400">
                        {pct(k.commission_rate)} commission
                      </span>
                    </div>
                    <div className="text-xs text-white/30">
                      {k.orders_30d} orders · {fmt(parseInt(k.revenue_30d_paise))} revenue (30d)
                    </div>
                    {k.upi_id && <div className="text-xs text-white/30 font-mono">UPI: {k.upi_id}</div>}
                  </div>
                  <button onClick={() => setEditing(k)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <AnimatePresence>
        {reviewing && (
          <ReviewModal open={!!reviewing} app={reviewing} onAction={handleReview} onClose={() => setReviewing(null)} />
        )}
        {editing && (
          <EditKitchenModal open={!!editing} kitchen={editing} onSave={handleEditKitchen} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
