"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, RefreshCw, CheckCircle2, Phone, MapPin } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { SkeletonList, SkeletonListRow } from "../components/ui/Skeleton";
import { ScreenError } from "../components/ui/ScreenError";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

interface SOSAlert {
  id: string;
  rider_id: string;
  rider_name: string;
  rider_phone: string;
  alert_type: string;
  latitude: number | null;
  longitude: number | null;
  order_id: string | null;
  order_display_id: string | null;
  status: "active" | "resolved";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

function ResolveModal({ alert, onClose, onResolved }: {
  alert: SOSAlert;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResolve = async () => {
    setLoading(true);
    try {
      await api.patch(`/support/sos-alerts/${alert.id}/resolve`, { resolutionNote: note || undefined });
      toast.success("SOS alert resolved");
      onResolved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve alert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Resolve SOS Alert</h3>
          <p className="text-sm text-zinc-500 mt-1">{alert.rider_name} — {alert.alert_type.replace(/_/g, " ")}</p>
        </div>
        <div>
          <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Resolution Note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Describe how the situation was resolved..."
            rows={3}
            className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/50 placeholder:text-white/20 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleResolve}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all disabled:opacity-50"
          >
            {loading ? "Resolving..." : "Mark Resolved"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SOSTab() {
  const [resolvingAlert, setResolvingAlert] = useState<SOSAlert | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["support-sos"],
    queryFn: async () => {
      const res = await api.get("/support/sos-alerts");
      return res.alerts as SOSAlert[];
    },
    refetchInterval: 15_000,
  });

  useSocketRefresh(["sos_alert", "sos_resolved"], refetch);

  const alerts = data ?? [];
  const activeAlerts   = alerts.filter(a => a.status === "active");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");

  if (isError) {
    return <ScreenError onRetry={refetch} message={(error as any)?.message || "Failed to load SOS alerts"} />;
  }

  return (
    <div className="p-6 space-y-6">
      {resolvingAlert && (
        <ResolveModal
          alert={resolvingAlert}
          onClose={() => setResolvingAlert(null)}
          onResolved={refetch}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            SOS Alerts
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">Emergency alerts from riders in the field</p>
        </div>
        <div className="flex items-center gap-3">
          {activeAlerts.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {activeAlerts.length} Active
            </span>
          )}
          <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} item={<SkeletonListRow />} />
      ) : alerts.length === 0 ? (
        <div className="py-20 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-50" />
          <p className="text-zinc-400 font-semibold">No SOS alerts</p>
          <p className="text-zinc-600 text-sm mt-1">All riders are safe</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Active Alerts</h3>
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <div key={alert.id} className="bg-red-500/[0.05] border border-red-500/25 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            ACTIVE
                          </span>
                          <span className="text-xs text-zinc-500 capitalize font-medium">
                            {alert.alert_type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">{alert.rider_name}</p>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {alert.rider_phone}
                          </span>
                          {alert.latitude && alert.longitude && (
                            <a
                              href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                            >
                              <MapPin className="w-3 h-3" /> View Location
                            </a>
                          )}
                          {alert.order_display_id && (
                            <span>Order <span className="font-mono text-zinc-400">#{alert.order_display_id}</span></span>
                          )}
                          <span>{timeAgo(alert.created_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setResolvingAlert(alert)}
                        className="shrink-0 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl transition-all whitespace-nowrap"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved alerts */}
          {resolvedAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-3">Resolved</h3>
              <div className="space-y-2">
                {resolvedAlerts.map(alert => (
                  <div key={alert.id} className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 opacity-60">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm text-zinc-400 font-medium">{alert.rider_name}</span>
                      <span className="text-xs text-zinc-600 capitalize">{alert.alert_type.replace(/_/g, " ")}</span>
                      {alert.resolved_at && (
                        <span className="text-xs text-zinc-600">Resolved {timeAgo(alert.resolved_at)}</span>
                      )}
                      {alert.resolution_note && (
                        <span className="text-xs text-zinc-500 italic truncate max-w-xs">{alert.resolution_note}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
