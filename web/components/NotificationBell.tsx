"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCheck, Package, Bike, X } from "lucide-react";
import { api } from "../app/lib/api";
import { useAuth } from "../app/providers";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  order_confirmed:        <Package className="w-3.5 h-3.5 text-green-400" />,
  order_preparing:        <Package className="w-3.5 h-3.5 text-yellow-400" />,
  order_ready:            <Package className="w-3.5 h-3.5 text-blue-400" />,
  order_out_for_delivery: <Bike className="w-3.5 h-3.5 text-orange-400" />,
  order_delivered:        <CheckCheck className="w-3.5 h-3.5 text-green-400" />,
  order_cancelled:        <X className="w-3.5 h-3.5 text-red-400" />,
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth()!;
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d: any = await api.get("/notifications");
      setNotifs(d.notifications ?? []);
      setUnread(d.unreadCount ?? 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function markAllRead() {
    try {
      await api.post("/notifications/read-all");
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
      setUnread(0);
    } catch {}
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
      setUnread(u => Math.max(0, u - 1));
    } catch {}
  }

  if (!user || user.role !== "customer") return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative w-10 h-10 rounded-full bg-[#111] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-md"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-[#111] border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <p className="text-white text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-zinc-400 hover:text-white transition-colors">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/50">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-zinc-600 text-sm">No notifications yet</div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-800/40 transition-colors flex gap-3 items-start ${!n.is_read ? "bg-zinc-800/20" : ""}`}
                >
                  <span className="mt-0.5 shrink-0">
                    {TYPE_ICON[n.type] ?? <Bell className="w-3.5 h-3.5 text-zinc-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium leading-snug ${n.is_read ? "text-zinc-300" : "text-white"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
