"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, User, Shield, AlertTriangle, Clock, RefreshCw, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { toast } from "sonner";
import { SkeletonList, SkeletonListRow } from "../components/ui/Skeleton";
import { ScreenError } from "../components/ui/ScreenError";

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
  order_total_paise: number | null;
  refund_eligible: boolean;
  suggested_refund_paise: number;
  auto_resolved: boolean;
  abuse_flag: boolean;
  resolution: string | null;
  resolution_type: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: "user" | "support" | "system" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
}

interface Props {
  ticketId: string;
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  normal:   "text-blue-400 bg-blue-500/10 border-blue-500/30",
  low:      "text-zinc-400 bg-zinc-800 border-zinc-700",
};

const STATUS_OPTIONS = [
  { value: "open",          label: "Open" },
  { value: "in_progress",   label: "In Progress" },
  { value: "awaiting_user", label: "Awaiting Reply" },
  { value: "escalated",     label: "Escalated" },
  { value: "resolved",      label: "Resolved" },
  { value: "closed",        label: "Closed" },
];

const PRIORITY_OPTIONS = ["low", "normal", "high", "critical"];

function slaCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "SLA Breached", className: "text-red-400" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const text = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  const className = diff < 4 * 3600000 ? "text-amber-400" : "text-zinc-500";
  return { text, className };
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

export function TicketThread({ ticketId, onClose }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [showResolutionInput, setShowResolutionInput] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get(`/support/tickets/${ticketId}`);
      setTicket(res.ticket);
      setMessages(res.messages || []);
    } catch (e: any) {
      setError(e.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  // Real-time: socket (instant) + 10-second poll fallback (catches missed events)
  useEffect(() => {
    socket.connect();
    const handler = (data: { ticketId: string }) => {
      if (data?.ticketId === ticketId) load();
    };
    socket.on("ticket_message", handler);
    const poll = setInterval(load, 10000);
    return () => {
      socket.off("ticket_message", handler);
      clearInterval(poll);
    };
  }, [ticketId, load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    const optimisticMsg: TicketMessage = {
      id: `temp-${Date.now()}`,
      ticket_id: ticketId,
      sender_id: "me",
      sender_type: "support",
      sender_name: "You",
      message: reply.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setReply("");
    try {
      await api.post(`/support/tickets/${ticketId}/reply`, { message: optimisticMsg.message });
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to send reply");
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setReply(optimisticMsg.message);
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!ticket) return;
    setUpdatingStatus(true);
    const prev = ticket.status;
    setTicket(t => t ? { ...t, status: status as Ticket["status"] } : t);
    try {
      await api.patch(`/support/tickets/${ticketId}/status`, {
        status,
        ...(status === "resolved" && resolutionText ? { resolution: resolutionText } : {}),
      });
      toast.success(`Status changed to ${STATUS_OPTIONS.find(s => s.value === status)?.label}`);
      setShowResolutionInput(false);
      setResolutionText("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
      setTicket(t => t ? { ...t, status: prev } : t);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const changePriority = async (priority: string) => {
    if (!ticket) return;
    setUpdatingPriority(true);
    const prev = ticket.priority;
    setTicket(t => t ? { ...t, priority: priority as Ticket["priority"] } : t);
    try {
      await api.patch(`/support/tickets/${ticketId}/priority`, { priority });
      toast.success(`Priority set to ${priority}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update priority");
      setTicket(t => t ? { ...t, priority: prev } : t);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const assignToSelf = async () => {
    try {
      await api.patch(`/support/tickets/${ticketId}/assign`, {});
      toast.success("Ticket assigned to you");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign ticket");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a14] border-l border-white/[0.05]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <div className="h-5 w-40 bg-white/[0.06] rounded-lg animate-pulse" />
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button>
        </div>
        <SkeletonList rows={6} item={<SkeletonListRow />} />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a14] border-l border-white/[0.05]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <span className="text-sm font-bold text-white/60">Ticket</span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button>
        </div>
        <ScreenError onRetry={load} message={error || "Ticket not found"} />
      </div>
    );
  }

  const sla = slaCountdown(ticket.sla_deadline);
  const userTypeBadge = ticket.user_type === "customer"
    ? "text-purple-400 bg-purple-500/10 border-purple-500/30"
    : "text-green-400 bg-green-500/10 border-green-500/30";

  return (
    <div className="flex flex-col h-full bg-[#0a0a14] border-l border-white/[0.05]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${userTypeBadge}`}>
                <User className="w-3 h-3" />
                {ticket.user_type === "customer" ? "Customer" : "Rider"}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${PRIORITY_COLORS[ticket.priority]}`}>
                {ticket.priority}
              </span>
              {ticket.abuse_flag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                  <AlertTriangle className="w-3 h-3" /> Abuse Flag
                </span>
              )}
              {ticket.auto_resolved && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Auto-resolved
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white truncate">{ticket.subject}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {ticket.user_name} · {ticket.user_phone}
              {ticket.order_display_id && <> · Order <span className="text-zinc-400 font-mono">#{ticket.order_display_id}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <span className={`flex items-center gap-1 font-semibold ${sla.className}`}>
            <Clock className="w-3 h-3" /> {sla.text}
          </span>
          <span className="text-zinc-600">
            {ticket.assigned_to_name
              ? <><span className="text-zinc-400">Assigned:</span> {ticket.assigned_to_name}</>
              : <span className="text-zinc-500">Unassigned</span>
            }
          </span>
          <span className="text-zinc-500 capitalize">{ticket.sub_type.replace(/_/g, " ")}</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-2 flex-wrap">
        {/* Status dropdown */}
        <div className="relative group">
          <button
            disabled={updatingStatus}
            className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            {updatingStatus ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
            {STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status}
            <ChevronDown className="w-3 h-3" />
          </button>
          <div className="absolute top-full left-0 mt-1 bg-[#141420] border border-white/10 rounded-xl shadow-xl py-1 z-20 hidden group-hover:block min-w-[150px]">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === "resolved") setShowResolutionInput(true);
                  else changeStatus(opt.value);
                }}
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority dropdown */}
        <div className="relative group">
          <button
            disabled={updatingPriority}
            className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            Priority: {ticket.priority}
            <ChevronDown className="w-3 h-3" />
          </button>
          <div className="absolute top-full left-0 mt-1 bg-[#141420] border border-white/10 rounded-xl shadow-xl py-1 z-20 hidden group-hover:block min-w-[120px]">
            {PRIORITY_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => changePriority(p)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors ${PRIORITY_COLORS[p]}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Assign to self */}
        <button
          onClick={assignToSelf}
          className="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        >
          <Shield className="w-3 h-3" /> Assign to Me
        </button>
      </div>

      {/* Resolution input (shown when resolving) */}
      {showResolutionInput && (
        <div className="px-5 py-3 border-b border-white/[0.05] bg-emerald-500/5 space-y-2">
          <p className="text-xs font-semibold text-emerald-400">Add resolution note (optional)</p>
          <textarea
            value={resolutionText}
            onChange={e => setResolutionText(e.target.value)}
            placeholder="What was done to resolve this ticket?"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 placeholder:text-white/20 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => changeStatus("resolved")}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg transition-all"
            >
              Confirm Resolve
            </button>
            <button
              onClick={() => { setShowResolutionInput(false); setResolutionText(""); }}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-xs font-bold rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 text-sm">No messages yet</div>
        ) : (
          messages.map(msg => {
            const isUser    = msg.sender_type === "user";
            const isSystem  = msg.sender_type === "system";
            const isSupport = msg.sender_type === "support" || msg.sender_type === "admin";

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="text-xs text-zinc-600 bg-white/[0.03] border border-white/5 px-3 py-1 rounded-full">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] space-y-1 ${isUser ? "items-start" : "items-end"} flex flex-col`}>
                  <span className="text-[10px] text-zinc-600 px-1">
                    {msg.sender_name} · {timeAgo(msg.created_at)}
                  </span>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? "bg-blue-500/10 border border-blue-500/20 text-white/90 rounded-tl-sm"
                      : "bg-sky-500/15 border border-sky-500/25 text-white/90 rounded-tr-sm"
                  }`}>
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="px-5 py-4 border-t border-white/[0.05]">
        <div className="flex gap-3 items-end">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500/50 placeholder:text-white/20 resize-none"
          />
          <button
            onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="p-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white rounded-xl transition-all shrink-0"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
