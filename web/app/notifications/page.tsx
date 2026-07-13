"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, Package, Bike, X, Trash2, Loader2, Gift, Wallet, Star } from "lucide-react";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { useAuth } from "../providers";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  order_confirmed:        <Package className="w-5 h-5 text-green-500" />,
  order_preparing:        <Package className="w-5 h-5 text-yellow-500" />,
  order_ready:            <Package className="w-5 h-5 text-blue-500" />,
  order_out_for_delivery: <Bike className="w-5 h-5 text-brand-primary" />,
  order_delivered:        <CheckCheck className="w-5 h-5 text-green-500" />,
  order_cancelled:        <X className="w-5 h-5 text-red-500" />,
  promo:                  <Gift className="w-5 h-5 text-purple-500" />,
  wallet:                 <Wallet className="w-5 h-5 text-blue-500" />,
  loyalty:                <Star className="w-5 h-5 text-amber-500" />,
};

const TYPE_BG: Record<string, string> = {
  order_confirmed:        "bg-green-50",
  order_preparing:        "bg-yellow-50",
  order_ready:            "bg-blue-50",
  order_out_for_delivery: "bg-brand-primary/10",
  order_delivered:        "bg-green-50",
  order_cancelled:        "bg-red-50",
  promo:                  "bg-purple-50",
  wallet:                 "bg-blue-50",
  loyalty:                "bg-amber-50",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const d: any = await api.get("/notifications");
      setNotifs(d.notifications ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login?redirect=/notifications"); return; }
    if (user) load();
  }, [user, authLoading, router, load]);

  // Real-time: refresh list when a new notification arrives via socket
  useEffect(() => {
    if (!user) return;
    socket.connect();
    socket.on("new_notification", load);
    return () => { socket.off("new_notification", load); };
  }, [user, load]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Failed to mark all as read.");
    }
  };

  const clearAll = async () => {
    if (!confirm("Clear all notifications?")) return;
    setClearingAll(true);
    try {
      await api.delete("/notifications");
      setNotifs([]);
      toast.success("All notifications cleared.");
    } catch {
      toast.error("Failed to clear notifications.");
    } finally {
      setClearingAll(false);
    }
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-20">
      <Toaster richColors position="top-center" />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/menu" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-sm font-semibold text-brand-primary hover:text-brand-dark transition-colors">
                Mark all read
              </button>
            )}
            {notifs.length > 0 && (
              <button onClick={clearAll} disabled={clearingAll} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-red-600 transition-colors disabled:opacity-50">
                {clearingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clear all
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-8">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Bell className="w-10 h-10 text-zinc-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">No notifications yet</h3>
            <p className="text-zinc-500 text-sm">Order updates, offers, and wallet credits will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(n => (
              <button
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id); }}
                className={`w-full text-left rounded-2xl border p-5 flex gap-4 items-start transition-all hover:shadow-md ${
                  n.is_read
                    ? "bg-white border-zinc-100 shadow-sm"
                    : "bg-white border-brand-primary/20 shadow-sm ring-1 ring-brand-primary/10"
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${TYPE_BG[n.type] ?? "bg-zinc-100"}`}>
                  {TYPE_ICON[n.type] ?? <Bell className="w-5 h-5 text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${n.is_read ? "text-zinc-700" : "text-zinc-900"}`}>{n.title}</p>
                    {!n.is_read && <span className="shrink-0 w-2 h-2 rounded-full bg-brand-primary mt-1.5" />}
                  </div>
                  <p className="text-sm text-zinc-500 mt-0.5 leading-snug">{n.body}</p>
                  <p className="text-xs text-zinc-400 mt-1.5">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
