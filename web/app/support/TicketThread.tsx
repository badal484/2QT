"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, User, Shield, AlertTriangle, Clock, RefreshCw, ChevronDown, ShoppingBag, Link2, IndianRupee, ArrowUpRight } from "lucide-react";
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
  linked_order_id: string | null;
  order_display_id: string | null;
  order_total_paise: number | null;
  order_payment_method: string | null;
  refund_eligible: boolean;
  suggested_refund_paise: number;
  escalated_to: string | null;
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

function paise(p: number) {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

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
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Link order state
  const [showLinkOrder, setShowLinkOrder] = useState(false);
  const [linkOrderId, setLinkOrderId] = useState("");
  const [linkingOrder, setLinkingOrder] = useState(false);

  // Escalate to finance state
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateAmount, setEscalateAmount] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [escalating, setEscalating] = useState(false);

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
    const poll = setInterval(load, 5000);
    return () => {
      socket.off("ticket_message", handler);
      clearInterval(poll);
    };
  }, [ticketId, load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const linkOrder = async () => {
    if (!linkOrderId.trim()) return;
    setLinkingOrder(true);
    try {
      await api.patch(`/support/tickets/${ticketId}/link-order`, { orderDisplayId: linkOrderId.trim() });
      toast.success("Order linked to ticket");
      setShowLinkOrder(false);
      setLinkOrderId("");
      load();
    } catch (e: any) {
      toast.error(e.message === "ORDER_NOT_FOUND" ? "Order not found — check the ID" : (e.message || "Failed to link order"));
    } finally {
      setLinkingOrder(false);
    }
  };

  const escalateToFinance = async () => {
    const amountPaise = Math.round(parseFloat(escalateAmount) * 100);
    if (!escalateAmount || isNaN(amountPaise) || amountPaise <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    setEscalating(true);
    try {
      await api.post(`/support/tickets/${ticketId}/escalate-to-finance`, {
        amountPaise,
        note: escalateNote.trim() || undefined,
      });
      toast.success("Escalated to Finance — refund request created");
      setShowEscalate(false);
      setEscalateAmount("");
      setEscalateNote("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to escalate");
    } finally {
      setEscalating(false);
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

  const isTerminal = ticket.status === "resolved" || ticket.status === "closed";
  const alreadyEscalatedToFinance = ticket.escalated_to === "finance";
  const canEscalate = !!ticket.order_display_id && !alreadyEscalatedToFinance && !isTerminal;

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
              {alreadyEscalatedToFinance && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <ArrowUpRight className="w-3 h-3" /> Finance
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white truncate">{ticket.subject}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {ticket.user_name} · {ticket.user_phone}
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

      {/* ── Order card ─────────────────────────────────────────────────────────── */}
      {ticket.order_display_id ? (
        <div className="mx-5 my-3 flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
          <ShoppingBag className="w-4 h-4 text-zinc-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 mb-0.5">Linked Order</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-white font-mono">#{ticket.order_display_id}</span>
              {ticket.order_total_paise != null && (
                <span className="text-sm font-semibold text-emerald-400">{paise(ticket.order_total_paise)}</span>
              )}
              {ticket.order_payment_method && (
                <span className="text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full capitalize">
                  {ticket.order_payment_method.replace(/_/g, " ")}
                </span>
              )}
              {alreadyEscalatedToFinance && ticket.suggested_refund_paise > 0 && (
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Refund: {paise(ticket.suggested_refund_paise)}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* No order linked — show link UI */
        <div className="mx-5 my-3">
          {!showLinkOrder ? (
            <button
              onClick={() => setShowLinkOrder(true)}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 border border-dashed border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 w-full transition-all"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link an order to this ticket
            </button>
          ) : (
            <div className="flex gap-2 items-center bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2">
              <Link2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                autoFocus
                value={linkOrderId}
                onChange={e => setLinkOrderId(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") linkOrder(); if (e.key === "Escape") setShowLinkOrder(false); }}
                placeholder="Order ID (e.g. A1B2C)"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20 font-mono"
              />
              <button
                onClick={linkOrder}
                disabled={linkingOrder || !linkOrderId.trim()}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 disabled:opacity-40 shrink-0"
              >
                {linkingOrder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Link"}
              </button>
              <button onClick={() => setShowLinkOrder(false)} className="text-zinc-600 hover:text-zinc-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="px-5 py-3 border-t border-b border-white/[0.05] flex items-center gap-2 flex-wrap">
        {/* Status dropdown */}
        <div className="relative" ref={statusRef}>
          <button
            disabled={updatingStatus}
            onClick={() => { setStatusOpen(o => !o); setPriorityOpen(false); }}
            className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            {updatingStatus ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
            {STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status}
            <ChevronDown className="w-3 h-3" />
          </button>
          {statusOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#141420] border border-white/10 rounded-xl shadow-xl py-1 z-20 min-w-[150px]">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStatusOpen(false);
                    if (opt.value === "resolved") setShowResolutionInput(true);
                    else changeStatus(opt.value);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority dropdown */}
        <div className="relative" ref={priorityRef}>
          <button
            disabled={updatingPriority}
            onClick={() => { setPriorityOpen(o => !o); setStatusOpen(false); }}
            className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            Priority: {ticket.priority}
            <ChevronDown className="w-3 h-3" />
          </button>
          {priorityOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#141420] border border-white/10 rounded-xl shadow-xl py-1 z-20 min-w-[120px]">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => { setPriorityOpen(false); changePriority(p); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors ${PRIORITY_COLORS[p]}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assign to self */}
        <button
          onClick={assignToSelf}
          className="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        >
          <Shield className="w-3 h-3" /> Assign to Me
        </button>

        {/* Escalate to Finance */}
        {canEscalate && (
          <button
            onClick={() => {
              setShowEscalate(e => !e);
              setShowResolutionInput(false);
              // Pre-fill amount from order total or suggested refund
              if (!escalateAmount) {
                const suggested = ticket.suggested_refund_paise > 0
                  ? ticket.suggested_refund_paise
                  : ticket.order_total_paise;
                if (suggested) setEscalateAmount((suggested / 100).toString());
              }
            }}
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ml-auto"
          >
            <IndianRupee className="w-3 h-3" /> Escalate to Finance
          </button>
        )}
      </div>

      {/* Resolution input */}
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

      {/* Escalate to Finance panel */}
      {showEscalate && (
        <div className="px-5 py-3 border-b border-white/[0.05] bg-amber-500/5 space-y-3">
          <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> Escalate to Finance — Refund Request
          </p>
          <p className="text-xs text-zinc-500">
            This creates a pending refund in the Finance queue. The finance team will approve and process it.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">₹</span>
              <input
                type="number"
                min="1"
                value={escalateAmount}
                onChange={e => setEscalateAmount(e.target.value)}
                placeholder="Refund amount"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 placeholder:text-white/20"
              />
            </div>
          </div>
          <textarea
            value={escalateNote}
            onChange={e => setEscalateNote(e.target.value)}
            placeholder="Reason / note for finance team (optional)"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 placeholder:text-white/20 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={escalateToFinance}
              disabled={escalating || !escalateAmount}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              {escalating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
              Confirm Escalation
            </button>
            <button
              onClick={() => { setShowEscalate(false); setEscalateAmount(""); setEscalateNote(""); }}
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
