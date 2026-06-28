"use client";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle, XCircle, Clock, Banknote, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const TYPE_LABELS: Record<string, string> = {
  wrong_item: "Wrong item",
  missing_item: "Missing item",
  quality_issue: "Quality issue",
  late_delivery: "Late delivery",
  rude_rider: "Rude rider",
  other: "Other",
};

const STATUS_META = {
  open:     { color: "bg-amber-100 text-amber-700",  icon: Clock,         label: "Open" },
  resolved: { color: "bg-green-100 text-green-700",  icon: CheckCircle,   label: "Resolved" },
  rejected: { color: "bg-red-100 text-red-700",      icon: XCircle,       label: "Rejected" },
};

function ComplaintCard({ c, onAction }: { c: any; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [scope, setScope] = useState<"full" | "partial" | "none">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const sm = STATUS_META[c.status as keyof typeof STATUS_META] ?? STATUS_META.open;
  const Icon = sm.icon;

  const resolve = async () => {
    setResolving(true);
    try {
      await api.post(`/complaints/${c.id}/resolve`, {
        refund_scope: scope,
        refund_amount_paise: scope === "partial" ? Number(partialAmount) * 100 : undefined,
        admin_note: adminNote || undefined,
      });
      toast.success("Complaint resolved — customer notified via WhatsApp");
      onAction();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setResolving(false);
  };

  const reject = async () => {
    setResolving(true);
    try {
      await api.post(`/complaints/${c.id}/reject`, { admin_note: adminNote || undefined });
      toast.success("Complaint rejected — customer notified");
      onAction();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setResolving(false);
  };

  return (
    <div className={`bg-white rounded-2xl border-2 p-5 ${c.status === 'open' ? 'border-amber-200' : 'border-zinc-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm">Order #{c.display_id}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.color}`}>
              <Icon size={10} className="inline mr-1"/>{sm.label}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {TYPE_LABELS[c.type] || c.type}
            </span>
            {c.is_cod_cash_order && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                <Banknote size={10}/> Cash COD
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {c.customer_name} · {c.customer_phone} · ₹{(c.total_amount_paise / 100).toFixed(0)}
          </p>
          <p className="text-sm text-zinc-700 mt-2 leading-relaxed">{c.description}</p>
          <p className="text-[10px] text-zinc-400 mt-1">{new Date(c.created_at).toLocaleString("en-IN")}</p>
        </div>
        {c.status === "open" && (
          <button onClick={() => setExpanded(!expanded)} className="text-zinc-400 hover:text-zinc-700 p-1">
            {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
        )}
      </div>

      {/* COD cash warning */}
      {c.is_cod_cash_order && c.status === "open" && (
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-medium">
          <Banknote size={14} className="inline mr-1.5"/>
          <strong>Cash COD order</strong> — rider {c.rider_name || "unknown"} collected the cash. If you approve a refund, the amount will be <strong>automatically deducted from their next payout</strong>.
        </div>
      )}

      {/* Resolved info */}
      {c.status !== "open" && (
        <div className="mt-3 bg-zinc-50 rounded-xl p-3 text-xs text-zinc-600">
          {c.refund_amount_paise > 0 && (
            <p><strong>Refund:</strong> ₹{(c.refund_amount_paise / 100).toFixed(0)} ({c.refund_scope})</p>
          )}
          {c.admin_note && <p className="mt-1"><strong>Note:</strong> {c.admin_note}</p>}
          {c.cod_cash_deduction_pending && !c.cod_cash_recovered && (
            <p className="mt-1 text-orange-600"><strong>Cash deduction pending</strong> from rider payout</p>
          )}
        </div>
      )}

      {/* Action panel */}
      {c.status === "open" && expanded && (
        <div className="mt-4 border-t border-zinc-100 pt-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Refund decision</label>
            <div className="flex gap-2 mt-1.5">
              {(["full", "partial", "none"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    scope === s ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-200"
                  }`}
                >
                  {s === "full" ? `Full refund (₹${(c.total_amount_paise/100).toFixed(0)})` : s === "partial" ? "Partial" : "No refund"}
                </button>
              ))}
            </div>
          </div>

          {scope === "partial" && (
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Refund amount (₹)</label>
              <input
                type="number"
                className="mt-1 w-40 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold"
                placeholder={`max ${(c.total_amount_paise/100).toFixed(0)}`}
                value={partialAmount}
                onChange={e => setPartialAmount(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Note to customer (optional)</label>
            <input
              className="mt-1 w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm"
              placeholder="e.g. We're sorry about this issue..."
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={resolve}
              disabled={resolving}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 disabled:opacity-50"
            >
              {resolving ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle size={13}/>}
              Approve {scope !== "none" ? "& Refund" : ""}
            </button>
            <button
              onClick={reject}
              disabled={resolving}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle size={13}/> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComplaintsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get(`/complaints/admin?status=${statusFilter}`);
      setComplaints(data?.complaints ?? []);
    } catch {}
    setIsLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["new_ticket", "ticket_updated"], load);

  const openCount = complaints.filter((c: any) => c.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">Customer Complaints</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Raised within 24h of delivery. Approve refund → credited to wallet instantly.
          Cash COD refunds auto-deducted from rider's next payout.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["open", "resolved", "rejected"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              statusFilter === s ? "bg-black text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {s} {s === "open" && openCount > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{openCount}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-zinc-300" size={28}/>
        </div>
      ) : complaints.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="font-semibold">No {statusFilter} complaints</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c: any) => (
            <ComplaintCard key={c.id} c={c} onAction={load}/>
          ))}
        </div>
      )}
    </div>
  );
}
