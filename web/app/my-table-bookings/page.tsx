"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Users, ChevronRight, UtensilsCrossed, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../providers";
import { Toaster } from "sonner";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   cls: "bg-amber-50 text-amber-600 border-amber-200",  icon: <AlertCircle className="w-3.5 h-3.5" /> },
  confirmed: { label: "Confirmed", cls: "bg-green-50 text-green-600 border-green-200",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  completed: { label: "Completed", cls: "bg-zinc-100 text-zinc-500 border-zinc-200",    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-500 border-red-200",        icon: <XCircle className="w-3.5 h-3.5" /> },
};

const TABS = ["upcoming", "completed", "cancelled"] as const;
type TabType = typeof TABS[number];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function MyTableBookingsPage() {
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login?redirect=/my-table-bookings"); return; }
    if (user) {
      setLoading(true);
      api.get(`/table-bookings/mine?status=${activeTab}`)
        .then((d: any) => setBookings(d.bookings ?? []))
        .catch(() => setBookings([]))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, activeTab, router]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-20">
      <Toaster richColors position="top-center" />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/table-booking" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">My Table Bookings</h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all capitalize ${
                activeTab === t
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />)}</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200 shadow-sm">
            <UtensilsCrossed className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-700 mb-2">No {activeTab} bookings</h3>
            {activeTab === "upcoming" && (
              <Link href="/table-booking" className="mt-4 inline-flex items-center gap-2 bg-brand-primary text-white px-5 py-3 rounded-xl text-sm font-bold hover:bg-brand-dark transition-all shadow-md">
                Book a Table
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b: any) => {
              const meta = STATUS_META[b.status] ?? STATUS_META.pending;
              return (
                <Link key={b.id} href={`/my-table-bookings/${b.id}`}>
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex gap-4 hover:border-brand-primary/30 hover:shadow-md transition-all">
                    <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-bold text-zinc-900 text-sm truncate">{b.restaurant_name}</p>
                        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${meta.cls}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(b.slot_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {fmtTime(b.slot_start)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {b.party_size} guests
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 self-center shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
