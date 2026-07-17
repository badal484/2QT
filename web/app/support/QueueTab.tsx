"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, Clock, User, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { SkeletonList, SkeletonListRow } from "../components/ui/Skeleton";
import { ScreenError } from "../components/ui/ScreenError";
import { TicketThread } from "./TicketThread";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

interface Ticket {
  id: string;
  user_type: "customer" | "rider";
  user_name: string;
  user_phone: string;
  ticket_type: string;
  sub_type: string;
  subject: string;
  status: "open" | "in_progress" | "awaiting_user" | "escalated" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  sla_deadline: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  order_display_id: string | null;
  abuse_flag: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  normal:   "text-blue-400 bg-blue-500/10 border-blue-500/30",
  low:      "text-zinc-400 bg-zinc-800 border-zinc-700",
};

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

function slaCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "SLA Breached", className: "text-red-400 font-bold" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const className = diff < 4 * 3600000 ? "text-amber-400" : "text-zinc-500";
  return { text: `${text} left`, className };
}

export default function QueueTab() {
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "customer" | "rider">("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["support-queue"],
    queryFn: async () => {
      const res = await api.get("/support/tickets?status=open");
      return res.tickets as Ticket[];
    },
    refetchInterval: 30000,
  });

  useSocketRefresh(["new_ticket", "ticket_updated"], refetch);

  const tickets = (data ?? [])
    .filter(t => {
      if (userFilter !== "all" && t.user_type !== userFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.user_name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
    });

  const claimTicket = useCallback(async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    setClaiming(ticketId);
    try {
      await api.patch(`/support/tickets/${ticketId}/assign`, {});
      toast.success("Ticket claimed");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to claim ticket");
    } finally {
      setClaiming(null);
    }
  }, [refetch]);

  if (isError) {
    return <ScreenError onRetry={refetch} message={(error as any)?.message || "Failed to load queue"} />;
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className={`flex flex-col flex-1 min-w-0 ${selectedTicketId ? "hidden lg:flex" : "flex"}`}>
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Support Queue</h2>
              <p className="text-zinc-500 text-sm mt-0.5">Open &amp; escalated tickets, sorted by priority</p>
            </div>
            <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or subject..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-sky-500/40 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "customer", "rider"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setUserFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
                    userFilter === f
                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                      : "bg-white/[0.04] text-zinc-500 border border-white/[0.06] hover:text-white/80"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket list */}
          {isLoading ? (
            <SkeletonList rows={6} item={<SkeletonListRow />} />
          ) : tickets.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-semibold">Queue is empty</p>
              <p className="text-zinc-600 text-sm mt-1">No open tickets matching your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => {
                const sla = slaCountdown(ticket.sla_deadline);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-2xl p-4 cursor-pointer transition-all ${
                      selectedTicketId === ticket.id ? "border-sky-500/30 bg-sky-500/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Top row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${PRIORITY_COLORS[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
                            ticket.user_type === "customer"
                              ? "text-purple-400 bg-purple-500/10 border-purple-500/30"
                              : "text-green-400 bg-green-500/10 border-green-500/30"
                          }`}>
                            <User className="w-3 h-3" />
                            {ticket.user_type === "customer" ? "Customer" : "Rider"}
                          </span>
                          {ticket.abuse_flag && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                              <AlertTriangle className="w-3 h-3" /> Abuse
                            </span>
                          )}
                        </div>

                        {/* Subject + user */}
                        <p className="text-sm font-semibold text-white/90 truncate">{ticket.subject}</p>
                        <p className="text-xs text-zinc-500">
                          {ticket.user_name}
                          {ticket.order_display_id && <> · <span className="font-mono text-zinc-400">#{ticket.order_display_id}</span></>}
                          {" · "}
                          <span className="capitalize">{ticket.sub_type.replace(/_/g, " ")}</span>
                        </p>

                        {/* SLA + assigned */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs font-medium flex items-center gap-1 ${sla.className}`}>
                            <Clock className="w-3 h-3" /> {sla.text}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {ticket.assigned_to_name ?? "Unassigned"}
                          </span>
                        </div>
                      </div>

                      {/* Claim button */}
                      {!ticket.assigned_to && (
                        <button
                          onClick={e => claimTicket(e, ticket.id)}
                          disabled={claiming === ticket.id}
                          className="shrink-0 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {claiming === ticket.id ? "..." : "Claim"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Thread panel */}
      {selectedTicketId && (
        <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 h-screen sticky top-0 overflow-hidden flex flex-col">
          <TicketThread
            ticketId={selectedTicketId}
            onClose={() => setSelectedTicketId(null)}
          />
        </div>
      )}
    </div>
  );
}
