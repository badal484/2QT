"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, FileText, Car, Phone,
  Search, Filter, ExternalLink, RefreshCw, ShieldCheck,
  AlertTriangle, ChevronDown,
} from "lucide-react";
import { SkeletonList } from "../components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";

type DocStatus = "pending" | "approved" | "rejected";

interface RiderDoc {
  application_id: string;
  rider_id: string;
  rider_name: string;
  rider_phone: string;
  vehicle_type: string;
  license_number: string;
  id_photo_url: string | null;
  status: string;
  doc_review_status: DocStatus;
  doc_review_reason: string | null;
  doc_reviewed_at: string | null;
  is_verified: boolean;
  is_suspended: boolean;
  updated_at: string;
}

const STATUS_CFG: Record<DocStatus, { label: string; icon: any; cls: string; dot: string }> = {
  pending:  { label: "Pending Review", icon: Clock,        cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  approved: { label: "Approved",       icon: CheckCircle2, cls: "bg-green-500/10 text-green-400 border-green-500/20",   dot: "bg-green-400"  },
  rejected: { label: "Rejected",       icon: XCircle,      cls: "bg-red-500/10 text-red-400 border-red-500/20",         dot: "bg-red-400"    },
};

function RejectModal({ doc, onClose, onConfirm, loading }: { doc: RiderDoc; onClose: () => void; onConfirm: (reason: string) => void; loading: boolean }) {
  const [reason, setReason] = useState("");
  const PRESETS = [
    "Photo is blurry or unreadable",
    "Wrong document uploaded",
    "Document appears expired",
    "License number doesn't match photo",
    "Please upload a clearer selfie with ID",
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-black text-white mb-1">Reject Documents</h3>
        <p className="text-zinc-400 text-sm mb-4">
          <span className="text-white font-bold">{doc.rider_name}</span> will be notified with the reason.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                reason === p ? "bg-red-500/20 border-red-500/40 text-red-400" : "border-white/10 text-zinc-400 hover:border-white/20"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Or type a custom reason…"
          rows={3}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 resize-none mb-4"
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-zinc-400 text-sm font-bold hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="flex-1 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/25 transition-all disabled:opacity-40"
          >
            {loading ? "Rejecting…" : "Reject Documents"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function RiderDocumentsTab({ onOpenRider }: { onOpenRider?: (riderId: string) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocStatus | "all">("pending");
  const [rejectTarget, setRejectTarget] = useState<RiderDoc | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ documents: RiderDoc[] }>({
    queryKey: ["admin-rider-documents"],
    queryFn: () => api.get("/admin/riders/documents"),
    refetchInterval: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ riderId, action, reason }: { riderId: string; action: "approve" | "reject"; reason?: string }) =>
      api.patch(`/admin/riders/${riderId}/documents/review`, { action, reason }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? "Documents approved!" : "Documents rejected.");
      qc.invalidateQueries({ queryKey: ["admin-rider-documents"] });
      setRejectTarget(null);
    },
    onError: () => toast.error("Action failed. Please try again."),
  });

  const docs = data?.documents ?? [];
  const filtered = docs.filter(d => {
    const matchFilter = filter === "all" || d.doc_review_status === filter;
    const matchSearch = !search || d.rider_name.toLowerCase().includes(search.toLowerCase()) || d.rider_phone.includes(search);
    return matchFilter && matchSearch;
  });

  const counts = {
    pending:  docs.filter(d => d.doc_review_status === "pending").length,
    approved: docs.filter(d => d.doc_review_status === "approved").length,
    rejected: docs.filter(d => d.doc_review_status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Rider Documents</h2>
          <p className="text-zinc-400 text-sm font-medium">Review and approve KYC documents submitted by riders.</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-sm font-bold transition-all">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as const).map(f => {
          const count = f === "all" ? docs.length : counts[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                active
                  ? f === "pending" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                    : f === "approved" ? "bg-green-500/15 border-green-500/30 text-green-400"
                    : f === "rejected" ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : "bg-white/10 border-white/20 text-white"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8"
              }`}
            >
              {f === "pending" && <Clock size={13} />}
              {f === "approved" && <CheckCircle2 size={13} />}
              {f === "rejected" && <XCircle size={13} />}
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}

        {/* Search */}
        <div className="ml-auto flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Search size={14} className="text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rider…"
            className="bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none w-40"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white/3 rounded-2xl border border-white/8">
          <ShieldCheck size={36} className="text-zinc-600 mb-3" />
          <p className="text-zinc-400 font-bold text-sm">No documents in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(doc => {
              const cfg = STATUS_CFG[doc.doc_review_status] || STATUS_CFG.pending;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={doc.application_id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-zinc-900/60 border border-white/8 rounded-2xl p-5"
                >
                  <div className="flex items-start gap-4">
                    {/* Photo thumbnail */}
                    <div
                      className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer hover:border-white/30 transition-all"
                      onClick={() => doc.id_photo_url && setLightboxUrl(doc.id_photo_url)}
                    >
                      {doc.id_photo_url ? (
                        <img src={doc.id_photo_url} alt="ID" className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={24} className="text-zinc-600" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-white font-black text-base">{doc.rider_name}</h3>
                        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                          <Icon size={11} />
                          {cfg.label}
                        </span>
                        {doc.is_suspended && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">
                            <AlertTriangle size={11} /> Suspended
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} />
                          {doc.rider_phone}
                        </span>
                        {doc.vehicle_type && (
                          <span className="flex items-center gap-1.5">
                            <Car size={12} />
                            {doc.vehicle_type.charAt(0).toUpperCase() + doc.vehicle_type.slice(1)}
                          </span>
                        )}
                        {doc.license_number && (
                          <span className="flex items-center gap-1.5 font-mono text-xs">
                            <FileText size={12} />
                            {doc.license_number}
                          </span>
                        )}
                      </div>

                      {doc.doc_review_reason && (
                        <p className="mt-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-1.5">
                          Rejection reason: {doc.doc_review_reason}
                        </p>
                      )}

                      <p className="text-xs text-zinc-600 mt-1.5">
                        Submitted {new Date(doc.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {doc.doc_reviewed_at && ` · Reviewed ${new Date(doc.doc_reviewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {doc.id_photo_url && (
                        <button
                          onClick={() => setLightboxUrl(doc.id_photo_url!)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold transition-all"
                        >
                          <ExternalLink size={12} /> View Photo
                        </button>
                      )}
                      {onOpenRider && (
                        <button
                          onClick={() => onOpenRider(doc.rider_id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold transition-all"
                        >
                          Full Profile
                        </button>
                      )}
                      {doc.doc_review_status !== "approved" && (
                        <button
                          onClick={() => reviewMutation.mutate({ riderId: doc.rider_id, action: "approve" })}
                          disabled={reviewMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 text-xs font-bold transition-all disabled:opacity-40"
                        >
                          <CheckCircle2 size={12} /> Approve
                        </button>
                      )}
                      {doc.doc_review_status !== "rejected" && (
                        <button
                          onClick={() => setRejectTarget(doc)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="ID Document" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          doc={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={reason => reviewMutation.mutate({ riderId: rejectTarget.rider_id, action: "reject", reason })}
          loading={reviewMutation.isPending}
        />
      )}
    </div>
  );
}
