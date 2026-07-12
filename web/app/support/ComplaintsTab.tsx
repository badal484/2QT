"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, Clock, User, IndianRupee, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
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
  assigned_to_name: string | null;
  order_display_id: string | null;
  order_total_paise: number | null;
  refund_eligible: boolean;
  suggested_refund_paise: number;
  abuse_flag: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  normal:   "text-blue-400 bg-blue-500/10 border-blue-500/30",
  low:      "text-zinc-400 bg-zinc-800 border-zinc-700",
};

function paise(p: number) {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function slaCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "SLA Breached", className: "text-red-400 font-bold" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { text: `${text} left`, className: diff < 4 * 3600000 ? "text-amber-400" : "text-zinc-500" };
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

export default function ComplaintsTab() {
  const [search, setSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["support-complaints"],
    queryFn: async () => {
      const res = await api.get("/support/tickets?user_type=customer");
      return (res.tickets as Ticket[]).filter(t => t.ticket_type === "order_complaint");
    },
    refetchInterval: 60_000,
  });

  useSocketRefresh(["new_ticket", "ticket_updated"], refetch);

  const tickets = (data ?? []).filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.user_name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });

  if (isError) {
    return <ScreenError onRetry={refetch} message={(error as any)?.message || "Failed to load complaints"} />;
  }

  return (
    <div className="flex h-full">
      <div className={`flex flex-col flex-1 min-w-0 ${selectedTicketId ? "hidden lg:flex" : "flex"}`}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Order Complaints</h2>
              <p className="text-zinc-500 text-sm mt-0.5">Customer complaints about orders — missing items, wrong items, quality issues</p>
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
              placeholder="Search complaints..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-sky-500/40 placeholder:text-zinc-600"
            />
          </div>

          {isLoading ? (
            <SkeletonList rows={6} item={<SkeletonListRow />} />
          ) : tickets.length === 0 ? (
            <div className="py-20 text-center">
              <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-semibold">No complaints found</p>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${PRIORITY_COLORS[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border text-purple-400 bg-purple-500/10 border-purple-500/30">
                            <User className="w-3 h-3" /> Customer
                          </span>
                          {ticket.refund_eligible && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <IndianRupee className="w-3 h-3" /> Refund Eligible
                            </span>
                          )}
                          {ticket.abuse_flag && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                              Abuse
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-white/90 truncate">{ticket.subject}</p>
                        <p className="text-xs text-zinc-500">
                          {ticket.user_name}
                          {ticket.order_display_id && <> · <span className="font-mono text-zinc-400">#{ticket.order_display_id}</span></>}
                          {ticket.order_total_paise != null && <> · <span className="text-zinc-400">{paise(ticket.order_total_paise)}</span></>}
                          {" · "}
                          <span className="capitalize">{ticket.sub_type.replace(/_/g, " ")}</span>
                        </p>

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs font-medium flex items-center gap-1 ${sla.className}`}>
                            <Clock className="w-3 h-3" /> {sla.text}
                          </span>
                          {ticket.refund_eligible && ticket.suggested_refund_paise > 0 && (
                            <span className="text-xs text-emerald-400/80 font-medium">
                              Suggested refund: {paise(ticket.suggested_refund_paise)}
                            </span>
                          )}
                          <span className="text-xs text-zinc-600">{timeAgo(ticket.created_at)}</span>
                          <span className="text-xs text-zinc-600">{ticket.assigned_to_name ?? "Unassigned"}</span>
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
