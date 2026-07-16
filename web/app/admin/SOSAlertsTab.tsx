"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldAlert, CheckCircle2, RefreshCw, Clock, Phone, MapPin, AlertOctagon, Navigation } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const ALERT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  emergency:       { label: "🚨 Emergency",       color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-500/30" },
  share_location:  { label: "📍 Share Location",  color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-500/30" },
  silent:          { label: "🤫 Silent Alert",     color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-500/30" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SOSAlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const [resolving, setResolving] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ id: string } | null>(null);
  const [note, setNote] = useState("");
  const [liveLocLoading, setLiveLocLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getSosAlerts(filter);
      setAlerts(d.alerts ?? []);
    } catch {
      toast.error("Failed to load SOS alerts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh active alerts every 15s
  useEffect(() => {
    if (filter !== "active") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [filter, load]);

  const handleResolve = async (id: string, resolutionNote?: string) => {
    setResolving(id);
    try {
      await api.resolveSosAlert(id, resolutionNote);
      toast.success("Alert marked as resolved");
      setNoteModal(null);
      setNote("");
      load();
    } catch {
      toast.error("Failed to resolve alert");
    } finally {
      setResolving(null);
    }
  };

  const active = alerts.filter(a => a.status === "active");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Safety Alerts</h2>
            <p className="text-xs text-zinc-400">Real-time SOS from riders during deliveries</p>
          </div>
          {active.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
              {active.length} ACTIVE
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["active", "resolved", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
              filter === f
                ? f === "active" ? "bg-red-500 text-white" : "bg-zinc-700 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <CheckCircle2 className="w-12 h-12 mb-4 text-green-500/40" />
          <p className="text-lg font-semibold text-zinc-400">All clear</p>
          <p className="text-sm mt-1">No {filter === "all" ? "" : filter} SOS alerts</p>
        </div>
      )}

      {/* Alerts list */}
      <div className="space-y-3">
        {alerts.map(alert => {
          const meta = ALERT_META[alert.alert_type] ?? ALERT_META.emergency;
          const isActive = alert.status === "active";
          return (
            <div
              key={alert.id}
              className={`rounded-2xl border p-4 transition-all ${
                isActive
                  ? `bg-red-500/5 border-red-500/40 shadow-lg shadow-red-500/5`
                  : "bg-zinc-900 border-zinc-800"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Alert type icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} border ${meta.border}`}>
                  <AlertOctagon className={`w-5 h-5 ${meta.color}`} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                    {isActive && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse">
                        ACTIVE
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(alert.created_at)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Rider</p>
                      <p className="text-sm font-bold text-white mt-0.5">{alert.rider_name}</p>
                    </div>
                    {alert.rider_phone && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Phone</p>
                        <a
                          href={`tel:${alert.rider_phone}`}
                          className="text-sm font-bold text-orange-400 hover:underline mt-0.5 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {alert.rider_phone}
                        </a>
                      </div>
                    )}
                    {alert.order_display_id && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Order</p>
                        <p className="text-sm font-bold text-zinc-300 mt-0.5">{alert.order_display_id}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Location</p>
                      {alert.lat && alert.lng ? (
                        <a
                          href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold text-blue-400 hover:underline mt-0.5 flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" />
                          View on Maps
                        </a>
                      ) : (
                        <button
                          onClick={async () => {
                            setLiveLocLoading(alert.id);
                            try {
                              const d = await api.get(`/admin/riders/${alert.rider_id}/live-location`);
                              if (d.location?.lat && d.location?.lng) {
                                window.open(`https://www.google.com/maps?q=${d.location.lat},${d.location.lng}`, "_blank");
                              } else {
                                toast.error("No live location available — rider GPS may be off");
                              }
                            } catch {
                              toast.error("Could not fetch live location");
                            } finally {
                              setLiveLocLoading(null);
                            }
                          }}
                          disabled={liveLocLoading === alert.id}
                          className="text-sm font-bold text-orange-400 hover:underline mt-0.5 flex items-center gap-1 disabled:opacity-50"
                        >
                          <Navigation className="w-3 h-3" />
                          {liveLocLoading === alert.id ? "Fetching…" : "Live Location"}
                        </button>
                      )}
                    </div>
                  </div>

                  {alert.resolution_note && (
                    <p className="mt-2 text-xs text-zinc-400 bg-zinc-800 rounded-lg px-3 py-2">
                      Resolution: {alert.resolution_note}
                    </p>
                  )}
                </div>

                {/* Resolve button */}
                {isActive && (
                  <button
                    onClick={() => setNoteModal({ id: alert.id })}
                    disabled={resolving === alert.id}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    {resolving === alert.id ? "Resolving…" : "Resolve"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolution note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Resolve SOS Alert</h3>
            <p className="text-sm text-zinc-400 mb-4">Add a resolution note (optional but recommended).</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Called rider — false alarm, phone fell. Confirmed safe."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none h-24 focus:outline-none focus:border-zinc-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setNoteModal(null); setNote(""); }}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(noteModal.id, note.trim() || undefined)}
                disabled={!!resolving}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {resolving ? "Saving…" : "Mark Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
