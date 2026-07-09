"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Clock, UserX, Package } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const ISSUE_META: Record<string, { label: string; color: string; bg: string }> = {
  customer_unreachable:  { label: "Customer Unreachable", color: "text-amber-400",   bg: "bg-amber-400/10" },
  damaged_packaging:     { label: "Damaged Packaging",    color: "text-red-400",     bg: "bg-red-400/10" },
  wrong_order:           { label: "Wrong Order",          color: "text-rose-400",    bg: "bg-rose-400/10" },
  missing_items:         { label: "Missing Items",        color: "text-orange-400",  bg: "bg-orange-400/10" },
  unsafe_location:       { label: "Unsafe Location",      color: "text-purple-400",  bg: "bg-purple-400/10" },
  other:                 { label: "Other",                color: "text-zinc-400",    bg: "bg-zinc-400/10" },
};

const FILTER_OPTIONS = ["all", "unresolved", "resolved"] as const;
type Filter = (typeof FILTER_OPTIONS)[number];

export function RiderIssuesTab() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getRiderIssues();
      setIssues(d.issues ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load rider issues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string) => {
    setResolving(id);
    try {
      await api.resolveRiderIssue(id);
      toast.success("Issue marked as resolved");
      setIssues(prev => prev.map(i => i.id === id ? { ...i, resolved: true, resolved_at: new Date().toISOString() } : i));
    } catch {
      toast.error("Failed to resolve issue");
    } finally {
      setResolving(null);
    }
  };

  const shown = issues.filter(i => {
    if (filter === "unresolved") return !i.resolved;
    if (filter === "resolved")   return i.resolved;
    return true;
  });

  const unresolvedCount = issues.filter(i => !i.resolved).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Rider Issues</h2>
          <p className="text-zinc-400 text-sm font-medium">
            Field reports submitted by riders during deliveries.
            {unresolvedCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                {unresolvedCount} open
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filter === f
                ? "bg-white/10 text-white"
                : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/5"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white/[0.02] rounded-2xl animate-pulse border border-white/5" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white/[0.01] border border-white/5 rounded-[32px]">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
          <p className="text-white font-black text-xl mb-1">
            {filter === "unresolved" ? "All clear!" : "No issues found"}
          </p>
          <p className="text-zinc-500 text-sm">
            {filter === "unresolved" ? "No open rider issues at the moment." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(issue => {
            const meta = ISSUE_META[issue.issue_type] ?? ISSUE_META.other;
            return (
              <div
                key={issue.id}
                className={`bg-white/[0.02] border rounded-2xl p-6 flex items-start justify-between gap-6 transition-all ${
                  issue.resolved ? "border-white/5 opacity-60" : "border-white/10 hover:border-white/15"
                }`}
              >
                <div className="flex items-start gap-5 flex-1 min-w-0">
                  {/* Issue type badge */}
                  <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    {issue.issue_type === "customer_unreachable"
                      ? <UserX className={`w-4 h-4 ${meta.color}`} />
                      : <AlertTriangle className={`w-4 h-4 ${meta.color}`} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className={`text-xs font-black uppercase tracking-widest ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-zinc-600 text-xs">·</span>
                      <span className="text-zinc-400 text-xs font-bold flex items-center gap-1">
                        <Package className="w-3 h-3" /> #{issue.display_id}
                      </span>
                      {issue.resolved && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                          Resolved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm mb-2">
                      <span className="text-white font-semibold">{issue.rider_name}</span>
                      <span className="text-zinc-500 text-xs">{issue.rider_phone}</span>
                    </div>

                    {issue.notes && (
                      <p className="text-zinc-400 text-sm leading-relaxed mb-2 italic">"{issue.notes}"</p>
                    )}

                    <div className="flex items-center gap-1 text-zinc-600 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(issue.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                      {issue.customer_name && (
                        <span className="ml-2 text-zinc-600">· Customer: {issue.customer_name}</span>
                      )}
                    </div>
                  </div>
                </div>

                {!issue.resolved && (
                  <button
                    onClick={() => resolve(issue.id)}
                    disabled={resolving === issue.id}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {resolving === issue.id ? "…" : "Resolve"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
