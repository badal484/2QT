import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headset, X, Plus, Send, MessageSquare, Loader2, Clock, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "../../lib/api";
import { socket } from "../../lib/socket";
import { toast } from "sonner";

export function RiderSupportModal({ onClose }: { onClose: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    try {
      const data = await api.get("/riders/tickets");
      setTickets(data?.tickets || []);
    } catch (e) {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const loadTicket = async (ticket: any) => {
    setActiveTicket(ticket);
    try {
      const data = await api.get(`/riders/tickets/${ticket.id}/messages`);
      setMessages(data?.messages || []);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    } catch (e) {
      toast.error("Failed to load messages");
    }
  };

  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      if (activeTicket && msg.ticket_id === activeTicket.id) {
        setMessages(p => [...p, msg]);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      }
    };
    socket.on("ticket_message", handleNewMessage);
    return () => { socket.off("ticket_message", handleNewMessage); };
  }, [activeTicket]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDesc.trim()) return toast.error("Please fill all fields");
    try {
      const data = await api.post("/riders/tickets", { subject: newSubject, description: newDesc });
      toast.success("Ticket created");
      setIsCreating(false);
      setNewSubject("");
      setNewDesc("");
      fetchTickets();
      loadTicket(data.ticket);
    } catch (e) {
      toast.error("Failed to create ticket");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || !activeTicket) return;
    setSendingMsg(true);
    try {
      const data = await api.post(`/riders/tickets/${activeTicket.id}/messages`, { content: msgInput });
      setMessages(p => [...p, data.message]);
      setMsgInput("");
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    } catch (e) {
      toast.error("Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            {activeTicket ? (
              <button onClick={() => setActiveTicket(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Headset className="w-5 h-5 text-blue-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-white leading-none">{activeTicket ? `Ticket #${activeTicket.id.slice(0, 6)}` : "Help & Support"}</h2>
              <p className="text-zinc-500 text-xs font-semibold mt-1">{activeTicket ? activeTicket.subject : "24/7 Dispatch Team"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : isCreating ? (
            <div className="p-6 h-full overflow-y-auto">
              <h3 className="text-xl font-black text-white mb-6">Create New Ticket</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 block">Subject</label>
                  <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. Payment Issue, App Crash" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 block">Description</label>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Please describe the issue in detail..." rows={5} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3.5 border border-white/10 text-zinc-400 hover:text-white rounded-xl font-bold transition-all">Cancel</button>
                  <button type="submit" disabled={!newSubject || !newDesc} className="flex-1 py-3.5 bg-blue-500 text-white rounded-xl font-black disabled:opacity-50 transition-all hover:bg-blue-600">Submit</button>
                </div>
              </form>
            </div>
          ) : activeTicket ? (
            <div className="flex flex-col h-full bg-[#0a0a0a]">
              <div className="bg-white/[0.02] border-b border-white/[0.05] p-3 text-center">
                <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${activeTicket.status === 'open' ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-500/20 text-zinc-500'}`}>
                  {activeTicket.status === 'open' ? 'In Progress' : 'Closed'}
                </span>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => {
                  const isMine = m.sender_type === "rider";
                  return (
                    <div key={i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMine ? "bg-blue-500 text-white rounded-tr-sm" : "bg-zinc-800 text-white rounded-tl-sm border border-white/5"}`}>
                        <p className="text-sm">{m.content}</p>
                        <span className="text-[10px] opacity-60 mt-1 block font-medium">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {activeTicket.status === "open" ? (
                <form onSubmit={handleSend} className="p-4 border-t border-white/[0.05] bg-[#111] flex gap-2">
                  <input type="text" value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50" />
                  <button type="submit" disabled={!msgInput.trim() || sendingMsg} className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 transition-colors">
                    {sendingMsg ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                  </button>
                </form>
              ) : (
                <div className="p-4 border-t border-white/[0.05] bg-[#111] text-center text-sm text-zinc-500 font-medium">This ticket is closed.</div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col p-4">
              <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black text-sm uppercase tracking-widest hover:bg-blue-500/20 transition-all mb-4">
                <Plus className="w-4 h-4" /> New Ticket
              </button>
              <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
                {tickets.map(t => (
                  <button key={t.id} onClick={() => loadTicket(t)} className="w-full bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all rounded-2xl p-4 text-left flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.status === 'open' ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-500/20 text-zinc-500'}`}>
                      {t.status === 'open' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-white text-sm truncate pr-2">{t.subject}</h4>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap font-medium mt-0.5">{new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{t.status === 'open' ? 'Tap to view or reply' : 'Resolved'}</p>
                    </div>
                  </button>
                ))}
                {tickets.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-bold text-sm">No support tickets</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
