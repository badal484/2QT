"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, CheckCircle2, Clock, User } from "lucide-react";
import { api } from "../lib/api";
import { SkeletonList, SkeletonListRow } from "../components/ui/Skeleton";
import { ScreenError } from "../components/ui/ScreenError";
import { TicketThread } from "./TicketThread";

interface Ticket {
  id: string;
  user_type: "customer" | "rider";
  user_name: string;
  user_phone: string;
  ticket_type: string;
  sub_type: string;
  subject: string;
  status: string;
  priority: "low" | "normal" | "high" | "critical";
  assigned_to_name: string | null;
  order_display_id: string | null;
  resolution: string | null;
  resolution_type: string | null;
  auto_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  normal:   "text-blue-400 bg-blue-500/10 border-blue-500/30",
  low:      "text-zinc-400 bg-zinc-800 border-zinc-700",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function resolutionTime(created: string, resolved: string | null) {
  if (!resolved) return null;
  const diff = (new Date(resolved).getTime() - new Date(created).getTime()) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function ResolvedTab() {
  const [search, setSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["support-resolved"],
    queryFn: async () => {
      const res = await api.get("/support/tickets?status=resolved");
      return (res.tickets as Ticket[]).slice(0, 100);
    },
    refetchInterval: 120000,
  });

  const tickets = (data ?? []).filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.user_name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.resolution ?? "").toLowerCase().includes(q)
    );
  });

  if (isError) {
    return <ScreenError onRetry={refetch} message={(error as any)?.message || "Failed to load resolved tickets"} />;
  }

  return (
    <div className="flex h-full">
      <div className={`flex flex-col flex-1 min-w-0 ${selectedTicketId ? "hidden lg:flex" : "flex"}`}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Resolved</h2>
              <p className="text-zinc-500 text-sm mt-0.5">Last 100 resolved tickets</p>
            </div>
            <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resolved tickets..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-sky-500/40 placeholder:text-zinc-600"
            />
          </div>

          {isLoading ? (
            <SkeletonList rows={6} item={<SkeletonListRow />} />
          ) : tickets.length === 0 ? (
            <div className="py-20 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-40" />
              <p className="text-zinc-400 font-semibold">No resolved tickets found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => {
                const rt = resolutionTime(ticket.created_at, ticket.resolved_at);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] rounded-2xl p-4 cursor-pointer transition-all ${
                      selectedTicketId === ticket.id ? "border-sky-500/20 bg-sky-500/[0.03]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1.5">
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
                          {ticket.auto_resolved && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
                              Auto
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-white/80 truncate">{ticket.subject}</p>
                        <p className="text-xs text-zinc-600">
                          {ticket.user_name}
                          {ticket.order_display_id && <> · <span className="font-mono">#{ticket.order_display_id}</span></>}
                          {" · "}
                          <span className="capitalize">{ticket.sub_type.replace(/_/g, " ")}</span>
                        </p>

                        {ticket.resolution && (
                          <p className="text-xs text-zinc-500 italic truncate">"{ticket.resolution}"</p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-600">
                          {ticket.resolved_at && <span>{timeAgo(ticket.resolved_at)}</span>}
                          {rt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Resolved in {rt}
                            </span>
                          )}
                          {ticket.assigned_to_name && <span>by {ticket.assigned_to_name}</span>}
                          {ticket.resolution_type && (
                            <span className="capitalize">{ticket.resolution_type.replace(/_/g, " ")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
