"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Clock, Users, UtensilsCrossed, Loader2,
  CheckCircle2, XCircle, Star, Phone, RotateCcw, Download
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../providers";
import { toast, Toaster } from "sonner";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function TableBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user && id) {
      api.get(`/table-bookings/${id}`)
        .then((d: any) => {
          setBooking(d.booking ?? d);
          setFeedbackDone(!!(d.booking ?? d).food_rating);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, id, router]);

  const handleCancel = async () => {
    if (!confirm("Cancel this table booking? Any deposit will be refunded to your wallet.")) return;
    setCancelling(true);
    try {
      await api.post(`/table-bookings/${id}/cancel`, {});
      setBooking((b: any) => ({ ...b, status: "cancelled" }));
      toast.success("Booking cancelled. Refund initiated.");
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const submitFeedback = async () => {
    if (!foodRating || !serviceRating) { toast.error("Please rate both food and service."); return; }
    setSubmittingFeedback(true);
    try {
      await api.post(`/table-bookings/${id}/feedback`, {
        food_rating: foodRating,
        service_rating: serviceRating,
        comment: feedbackComment.trim(),
      });
      setFeedbackDone(true);
      toast.success("Thank you for your feedback!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-4">
      <p className="text-zinc-500">Booking not found.</p>
      <Link href="/my-table-bookings" className="text-brand-primary font-semibold text-sm">← My Bookings</Link>
    </div>
  );

  const isUpcoming = ["pending", "confirmed"].includes(booking.status);
  const isCompleted = booking.status === "completed";

  const STATUS_COLOR: Record<string, string> = {
    pending:   "bg-amber-50 text-amber-600 border-amber-200",
    confirmed: "bg-green-50 text-green-600 border-green-200",
    completed: "bg-zinc-100 text-zinc-500 border-zinc-200",
    cancelled: "bg-red-50 text-red-500 border-red-200",
  };

  function StarRow({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
    return (
      <div className="flex gap-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)}>
            <Star className={`w-7 h-7 transition-colors ${n <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-200"}`} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-20">
      <Toaster richColors position="top-center" />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/my-table-bookings" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Booking Details</h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-8 space-y-5">
        {/* Status banner */}
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${STATUS_COLOR[booking.status] ?? STATUS_COLOR.pending}`}>
          {booking.status === "confirmed" ? <CheckCircle2 className="w-5 h-5" /> :
           booking.status === "cancelled" ? <XCircle className="w-5 h-5" /> :
           <UtensilsCrossed className="w-5 h-5" />}
          <p className="font-bold capitalize">{booking.status}</p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-zinc-900">{booking.restaurant_name}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <Calendar className="w-4 h-4 text-brand-primary shrink-0" />
              {fmtDate(booking.slot_start)}
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <Clock className="w-4 h-4 text-brand-primary shrink-0" />
              {fmtTime(booking.slot_start)} – {fmtTime(booking.slot_end)}
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <Users className="w-4 h-4 text-brand-primary shrink-0" />
              {booking.party_size} guests
            </div>
          </div>
          {booking.occasion && (
            <div className="text-sm"><span className="text-zinc-400">Occasion: </span><span className="font-semibold">{booking.occasion}</span></div>
          )}
          {booking.special_requests && (
            <div className="text-sm p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-xs text-zinc-400 mb-1">Special Requests</p>
              <p className="text-zinc-700">{booking.special_requests}</p>
            </div>
          )}
          {booking.deposit_paise > 0 && (
            <div className="flex justify-between text-sm pt-3 border-t border-zinc-100">
              <span className="text-zinc-500">Deposit Paid</span>
              <span className="font-bold">₹{booking.deposit_paise / 100}</span>
            </div>
          )}
        </div>

        {/* Pre-order items */}
        {booking.pre_order && booking.pre_order.length > 0 && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
            <h3 className="font-bold text-zinc-900 mb-4">Pre-ordered Items</h3>
            <div className="space-y-3">
              {booking.pre_order.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-700">{item.name ?? item.menu_item_name} × {item.quantity}</span>
                  <span className="font-semibold">₹{((item.price_paise ?? 0) * item.quantity) / 100}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {isUpcoming && (
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel Booking
            </button>
            <a
              href="tel:+919999999999"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-all"
            >
              <Phone className="w-4 h-4" /> Call
            </a>
          </div>
        )}

        {/* Feedback */}
        {isCompleted && !feedbackDone && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-zinc-900">Rate your Experience</h3>
            <div>
              <p className="text-sm text-zinc-500 mb-2">Food Quality</p>
              <StarRow rating={foodRating} onChange={setFoodRating} />
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-2">Service</p>
              <StarRow rating={serviceRating} onChange={setServiceRating} />
            </div>
            <textarea
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Tell us about your experience…"
              rows={3}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-brand-primary/20 resize-none"
            />
            <button
              onClick={submitFeedback}
              disabled={submittingFeedback}
              className="w-full bg-brand-primary text-white py-3 rounded-xl text-sm font-bold hover:bg-brand-dark transition-all disabled:opacity-50"
            >
              {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit Feedback"}
            </button>
          </div>
        )}

        {isCompleted && feedbackDone && (
          <div className="bg-green-50 rounded-2xl border border-green-100 p-4 text-center text-green-700 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1" /> Thank you for your feedback!
          </div>
        )}
      </main>
    </div>
  );
}
