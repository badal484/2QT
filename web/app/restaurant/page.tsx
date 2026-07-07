"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Utensils, LogOut, RefreshCw, Users, Clock, CheckCircle2,
  Wallet, Bell, Package, UtensilsCrossed, CalendarCheck,
  ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "confirmed" | "seated" | "completed" | "cancelled" | "no_show";

type Booking = {
  id: string;
  display_id: string;
  status: BookingStatus;
  slot_start: string;
  slot_end: string;
  party_size: number;
  customer_name: string;
  table_number: number | null;
  occasion: string | null;
  pre_order_items: Array<{ name: string; quantity: number; status: string }>;
  pre_order_amount_paise: number;
  post_order_amount_paise: number;
  gst_amount_paise: number;
  total_paid_paise: number;
};

type TicketItem = {
  id: string;
  name: string;
  quantity: number;
  status: string;
  special_note?: string;
};

type Ticket = {
  booking_id: string;
  display_id: string;
  table_number: number | null;
  items: TicketItem[];
};

type BillEntry = {
  id: string;
  display_id: string;
  table_number: number | null;
  customer_name: string;
  party_size: number;
  pre_order_amount_paise: number;
  post_order_amount_paise: number;
  gst_amount_paise: number;
  total_paid_paise: number;
};

type ActiveTab = "today" | "orders" | "bill";
type TicketType = "pre" | "post";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(paise: number) {
  return (paise / 100).toLocaleString("en-IN");
}

function slotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onCheckIn,
  checkingIn,
}: {
  booking: Booking;
  onCheckIn: (id: string) => void;
  checkingIn: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const preItems = (booking.pre_order_items ?? []).filter(i => i.status !== "cancelled");
  const isSeated = booking.status === "seated";
  const isDone = booking.status === "completed" || booking.status === "no_show";

  return (
    <div className={`rounded-2xl border transition-all ${
      isSeated
        ? "bg-blue-500/[0.05] border-blue-500/25"
        : isDone
        ? "bg-white/[0.015] border-white/[0.05] opacity-50"
        : "bg-white/[0.03] border-white/[0.08] hover:border-white/15"
    }`}>
      <div className="flex items-center gap-4 p-5">
        {/* Table badge */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
          isSeated ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/10 text-amber-400"
        }`}>
          {booking.table_number ?? "—"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{booking.customer_name}</span>
            {booking.occasion && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-md font-bold">{booking.occasion}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{slotTime(booking.slot_start)}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{booking.party_size}</span>
            <span className="font-mono text-zinc-600">#{booking.display_id}</span>
          </div>
        </div>

        {/* Status + action */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
            isSeated
              ? "bg-blue-500/15 text-blue-400"
              : isDone
              ? "bg-white/[0.05] text-zinc-500"
              : "bg-amber-500/10 text-amber-400"
          }`}>
            {isSeated ? "Seated" : isDone ? booking.status.replace("_", " ") : "Arriving"}
          </span>

          {booking.status === "confirmed" && (
            <button
              onClick={() => onCheckIn(booking.id)}
              disabled={checkingIn === booking.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-xl transition-all disabled:opacity-50"
            >
              {checkingIn === booking.id
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : <CheckCircle2 className="w-3.5 h-3.5" />}
              Check In
            </button>
          )}

          {preItems.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {preItems.length} pre-order{preItems.length > 1 ? "s" : ""}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {expanded && preItems.length > 0 && (
        <div className="px-5 pb-4 border-t border-white/[0.06] pt-3">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Pre-ordered</div>
          <div className="flex flex-wrap gap-2">
            {preItems.map((item, i) => (
              <span key={i} className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1 text-zinc-300">
                {item.quantity}× {item.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-sm font-black text-amber-400">
          {ticket.table_number ?? "?"}
        </div>
        <div>
          <div className="text-sm font-bold text-white">Table {ticket.table_number ?? "Walk-in"}</div>
          <div className="text-[10px] font-mono text-zinc-500">#{ticket.display_id}</div>
        </div>
      </div>
      <div className="space-y-2">
        {ticket.items.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
            <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-black shrink-0">
              {item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{item.name}</div>
              {item.special_note && (
                <div className="text-xs text-amber-400/80 mt-0.5 truncate">Note: {item.special_note}</div>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
              item.status === "pending" ? "bg-amber-500/10 text-amber-400"
              : item.status === "preparing" ? "bg-blue-500/10 text-blue-400"
              : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bill Card ────────────────────────────────────────────────────────────────

function BillCard({ bill }: { bill: BillEntry }) {
  const food = bill.pre_order_amount_paise + bill.post_order_amount_paise;
  const total = food + bill.gst_amount_paise;
  const outstanding = Math.max(0, total - bill.total_paid_paise);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-sm font-black text-amber-400">
            {bill.table_number ?? "?"}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{bill.customer_name}</div>
            <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              {bill.party_size} guests · #{bill.display_id}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-white">₹{fmt(outstanding)}</div>
          <div className="text-[10px] text-zinc-500 font-medium">outstanding</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center bg-white/[0.02] rounded-xl p-3 border border-white/[0.05]">
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Food</div>
          <div className="text-sm font-bold text-white">₹{fmt(food)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">GST</div>
          <div className="text-sm font-bold text-white">₹{fmt(bill.gst_amount_paise)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Paid</div>
          <div className="text-sm font-bold text-emerald-400">₹{fmt(bill.total_paid_paise)}</div>
        </div>
      </div>

      <p className="text-[10px] text-zinc-600 mt-3 text-center">
        Customer settles via the 2QT app · contact them if payment is delayed
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RestaurantPage() {
  const { user, loading, logout } = useAuth()!;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [ticketType, setTicketType] = useState<TicketType>("pre");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [bills, setBills] = useState<BillEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadToday = useCallback(async () => {
    try {
      const data = await api.get("/kitchen/dine-in/today");
      setBookings(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load today's bookings"); }
  }, []);

  const loadTickets = useCallback(async (type: TicketType = "pre") => {
    try {
      const data = await api.get(`/kitchen/dine-in/tickets?type=${type}`);
      setTickets(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load food tickets"); }
  }, []);

  const loadBills = useCallback(async () => {
    try {
      const data = await api.get("/kitchen/dine-in/bill");
      setBills(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load bills"); }
  }, []);

  const refreshAll = useCallback(async (type: TicketType = ticketType) => {
    setFetching(true);
    await Promise.all([loadToday(), loadTickets(type), loadBills()]);
    setFetching(false);
  }, [loadToday, loadTickets, loadBills, ticketType]);

  // ── Auth + initial load ───────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (user.role !== "dine_in_staff") { router.push("/menu"); return; }
    refreshAll();
  }, [user, loading, router, refreshAll]);

  // ── Ticket type change ────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || user.role !== "dine_in_staff") return;
    loadTickets(ticketType);
  }, [ticketType, loadTickets, user]);

  // ── Socket ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || user.role !== "dine_in_staff") return;

    socket.connect();

    socket.on("new_table_booking", (d: any) => {
      loadToday();
      toast.success(`New booking #${d.displayId} — ${d.partySize} guests`);
      setAlertMsg("New booking!");
    });

    socket.on("table_checkin", (d: any) => {
      loadToday();
      toast.info(`#${d.displayId} checked in`);
    });

    socket.on("table_order", (d: any) => {
      loadTickets(ticketType);
      toast.info(`New ${d.type === "post_order" ? "add-on" : "pre-order"} items for #${d.displayId}`);
      setAlertMsg("New order!");
    });

    socket.on("table_checkout", (d: any) => {
      loadBills();
      loadToday();
      toast.success(`#${d.displayId} paid & checked out`);
    });

    socket.on("table_booking_updated", () => { loadToday(); });

    return () => {
      socket.off("new_table_booking");
      socket.off("table_checkin");
      socket.off("table_order");
      socket.off("table_checkout");
      socket.off("table_booking_updated");
      socket.disconnect();
    };
  }, [user, loadToday, loadTickets, loadBills, ticketType]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const checkIn = async (bookingId: string) => {
    setCheckingIn(bookingId);
    try {
      await api.post(`/table-bookings/${bookingId}/checkin`, {});
      toast.success("Guest checked in!");
      loadToday();
      loadBills();
    } catch (e: any) {
      toast.error(e?.error || "Check-in failed");
    } finally {
      setCheckingIn(null);
    }
  };

  // ── Derived counts ────────────────────────────────────────────────────────

  if (loading || !user) return null;

  const confirmedCount = bookings.filter(b => b.status === "confirmed").length;
  const seatedCount = bookings.filter(b => b.status === "seated").length;
  const now = new Date();
  const upcoming = bookings.filter(b =>
    b.status === "confirmed" && new Date(b.slot_start) <= new Date(now.getTime() + 30 * 60000)
  );

  const TABS = [
    { id: "today" as ActiveTab, label: "Today", icon: CalendarCheck, badge: confirmedCount + seatedCount },
    { id: "orders" as ActiveTab, label: "Food Orders", icon: UtensilsCrossed, badge: tickets.length },
    { id: "bill" as ActiveTab, label: "Bill", icon: Wallet, badge: bills.length },
  ];

  return (
    <div className="min-h-screen bg-[#06060d] text-white font-sans">

      {/* ── Header ── */}
      <header className="bg-[#0a0a14] border-b border-white/[0.06] px-5 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Utensils className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="font-black text-sm text-white leading-none">Restaurant Portal</div>
            <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{user.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {alertMsg && (
            <button
              onClick={() => setAlertMsg(null)}
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse"
            >
              <Bell className="w-3.5 h-3.5" />
              {alertMsg}
            </button>
          )}
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-500">
            <span><span className="text-blue-400 font-bold">{seatedCount}</span> seated</span>
            <span><span className="text-amber-400 font-bold">{confirmedCount}</span> arriving</span>
            <span><span className="text-red-400 font-bold">{bills.length}</span> unpaid</span>
          </div>
          <button
            onClick={() => { logout(); router.push("/"); }}
            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </header>

      {/* ── Upcoming alert banner ── */}
      {upcoming.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center gap-2 text-amber-400 text-xs font-bold">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {upcoming.length === 1
            ? `${upcoming[0].customer_name} arriving at ${slotTime(upcoming[0].slot_start)} — ${upcoming[0].party_size} guests`
            : `${upcoming.length} guests arriving in the next 30 minutes`}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="bg-[#0a0a14] border-b border-white/[0.06] px-5 flex items-center">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === t.id
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                activeTab === t.id ? "bg-amber-400 text-black" : "bg-white/[0.08] text-zinc-400"
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => refreshAll()}
          className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 py-3 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Content ── */}
      <main className="max-w-3xl mx-auto px-4 py-5">

        {/* ── TODAY ── */}
        {activeTab === "today" && (
          <div className="space-y-3">
            {bookings.length === 0 && !fetching && (
              <div className="py-24 text-center">
                <CalendarCheck className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-medium">No bookings today</p>
                <p className="text-zinc-600 text-xs mt-1">New bookings appear instantly via real-time sync</p>
              </div>
            )}

            {/* Group by status: confirmed first, then seated, then done */}
            {(["confirmed", "seated", "completed", "no_show"] as BookingStatus[]).map(status => {
              const group = bookings.filter(b => b.status === status);
              if (group.length === 0) return null;
              const label = status === "confirmed" ? "Arriving" : status === "seated" ? "Currently Seated" : status === "no_show" ? "No Show" : "Completed";
              return (
                <div key={status}>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">{label}</div>
                  <div className="space-y-2">
                    {group.map(b => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onCheckIn={checkIn}
                        checkingIn={checkingIn}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ORDERS ── */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["pre", "post"] as TicketType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTicketType(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    ticketType === t
                      ? "bg-amber-400 text-black"
                      : "bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]"
                  }`}
                >
                  {t === "pre" ? "Pre-orders" : "Add-ons (post)"}
                </button>
              ))}
            </div>

            {tickets.length === 0 && !fetching && (
              <div className="py-24 text-center">
                <Package className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-medium">
                  No pending {ticketType === "pre" ? "pre-orders" : "add-on orders"}
                </p>
              </div>
            )}

            {tickets.map(ticket => (
              <TicketCard key={ticket.booking_id} ticket={ticket} />
            ))}
          </div>
        )}

        {/* ── BILL ── */}
        {activeTab === "bill" && (
          <div className="space-y-3">
            {bills.length === 0 && !fetching && (
              <div className="py-24 text-center">
                <Wallet className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-medium">No outstanding bills</p>
                <p className="text-zinc-600 text-xs mt-1">All seated guests have settled their tabs</p>
              </div>
            )}
            {bills.map(b => <BillCard key={b.id} bill={b} />)}
          </div>
        )}

      </main>
    </div>
  );
}
