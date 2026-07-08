"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Users, ChevronRight, ChevronLeft, CheckCircle2, Plus, Minus, MessageSquare, Loader2, UtensilsCrossed } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../providers";
import { toast, Toaster } from "sonner";

const STEPS = ["Date & Guests", "Time Slot", "Pre-Order", "Requests", "Confirm"];
const OCCASIONS = ["Birthday", "Anniversary", "Date Night", "Business Dinner", "Family Gathering", "Other"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function TableBookingFormPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [partySize, setPartySize] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [preOrderItems, setPreOrderItems] = useState<Record<string, number>>({});
  const [specialRequests, setSpecialRequests] = useState("");
  const [occasion, setOccasion] = useState("");
  const [placing, setPlacing] = useState(false);

  const [restaurant, setRestaurant] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);

  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });

  const dateStr = fmtDate(selectedDate);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login?redirect=/table-booking"); return; }
    if (user && restaurantId) {
      api.get(`/restaurants/${restaurantId}`).then((d: any) => setRestaurant(d.restaurant ?? d)).catch(() => {});
    }
  }, [user, authLoading, restaurantId, router]);

  useEffect(() => {
    if (step !== 1 || !restaurantId) return;
    setSlotsLoading(true);
    api.get(`/restaurants/${restaurantId}/availability?date=${dateStr}&partySize=${partySize}`)
      .then((d: any) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [step, dateStr, partySize, restaurantId]);

  useEffect(() => {
    if (step !== 2 || !restaurantId) return;
    setMenuLoading(true);
    api.get(`/restaurants/${restaurantId}/menu`)
      .then((d: any) => setMenuItems(d.items ?? []))
      .catch(() => setMenuItems([]))
      .finally(() => setMenuLoading(false));
  }, [step, restaurantId]);

  const preOrderTotal = useMemo(() => {
    return Object.entries(preOrderItems).reduce((sum, [id, qty]) => {
      const item = menuItems.find(i => i.id === id);
      return sum + (item ? item.price_paise * qty : 0);
    }, 0);
  }, [preOrderItems, menuItems]);

  const depositPaise: number = restaurant?.deposit_paise ?? 0;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      document.body.appendChild(s);
      return () => { document.body.removeChild(s); };
    }
  }, []);

  const handleConfirm = async () => {
    setPlacing(true);
    try {
      const preOrder = Object.entries(preOrderItems)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

      const res = await api.post("/table-bookings", {
        restaurantId,
        slotStart: selectedSlot.slotStart,
        slotEnd: selectedSlot.slotEnd,
        partySize,
        preOrder,
        specialRequests: specialRequests.trim(),
        occasion: occasion.trim(),
      });

      if (res.requiresPayment && res.razorpayOrderId) {
        const options = {
          key: res.keyId,
          amount: res.amount,
          currency: "INR",
          name: restaurant?.name ?? "Table Booking",
          description: "Table deposit",
          order_id: res.razorpayOrderId,
          handler: async (response: any) => {
            try {
              await api.post("/table-bookings/verify-payment", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: res.bookingId,
              });
              toast.success("Table booked successfully!");
              router.push(`/my-table-bookings/${res.bookingId}`);
            } catch (e: any) {
              toast.error("Payment verification failed: " + e.message);
            }
          },
          theme: { color: "#FF6B35" },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        toast.success("Table booked successfully!");
        router.push(`/my-table-bookings/${res.bookingId}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Booking failed. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-primary animate-spin" /></div>;

  const canNext = [
    true,
    !!selectedSlot,
    true,
    true,
    true,
  ][step];

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-24">
      <Toaster richColors position="top-center" />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="text-zinc-500 hover:text-zinc-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link href="/table-booking" className="text-zinc-500 hover:text-zinc-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div className="flex-1">
            <h1 className="text-base font-bold text-zinc-900">{restaurant?.name ?? "Book a Table"}</h1>
            <p className="text-xs text-zinc-400">{STEPS[step]}</p>
          </div>
          <span className="text-xs font-semibold text-zinc-400">{step + 1} / {STEPS.length}</span>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-8">
        {/* Step 0: Date & Guests */}
        {step === 0 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-brand-primary" /> Select Date</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {dateOptions.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(d)}
                    className={`shrink-0 flex flex-col items-center px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${
                      fmtDate(d) === fmtDate(selectedDate)
                        ? "bg-brand-primary text-white border-brand-primary shadow-md"
                        : "bg-white border-zinc-200 text-zinc-700 hover:border-brand-primary/40"
                    }`}
                  >
                    <span className="text-xs opacity-70">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                    <span className="text-lg">{d.getDate()}</span>
                    <span className="text-xs opacity-70">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-brand-primary" /> Party Size</h2>
              <div className="flex items-center gap-6 bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm w-fit">
                <button onClick={() => setPartySize(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-all">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-3xl font-bold w-10 text-center">{partySize}</span>
                <button onClick={() => setPartySize(p => Math.min(20, p + 1))} className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-all">
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-sm text-zinc-500">guests</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Time Slot */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-brand-primary" /> Choose a Time Slot</h2>
            <p className="text-sm text-zinc-500 mb-6">{selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {partySize} guests</p>
            {slotsLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-zinc-200">
                <Clock className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="font-semibold text-zinc-700">No slots available</p>
                <p className="text-sm text-zinc-400 mt-1">Try a different date or party size</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {slots.map((slot: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSlot(slot)}
                    disabled={!slot.available}
                    className={`py-3 rounded-2xl border text-sm font-bold transition-all ${
                      !slot.available ? "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed" :
                      selectedSlot?.slotStart === slot.slotStart
                        ? "bg-brand-primary text-white border-brand-primary shadow-md"
                        : "bg-white border-zinc-200 text-zinc-700 hover:border-brand-primary/40"
                    }`}
                  >
                    {fmtTime(slot.slotStart)}
                    {!slot.available && <span className="block text-xs font-normal mt-0.5">Full</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pre-Order */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><UtensilsCrossed className="w-5 h-5 text-brand-primary" /> Pre-Order Food</h2>
            <p className="text-sm text-zinc-500 mb-6">Optional — pre-order so your food is ready when you arrive.</p>
            {menuLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-100 rounded-2xl animate-pulse" />)}</div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 text-zinc-400">Pre-ordering not available for this restaurant.</div>
            ) : (
              <div className="space-y-3">
                {menuItems.filter(i => i.available).map((item: any) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900 text-sm">{item.name}</p>
                      <p className="text-xs text-zinc-500">₹{item.price_paise / 100}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {preOrderItems[item.id] > 0 ? (
                        <>
                          <button onClick={() => setPreOrderItems(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold">{preOrderItems[item.id]}</span>
                          <button onClick={() => setPreOrderItems(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))}
                            className="w-8 h-8 rounded-full bg-brand-primary text-white hover:bg-brand-dark flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setPreOrderItems(p => ({ ...p, [item.id]: 1 }))}
                          className="w-8 h-8 rounded-full bg-brand-primary text-white hover:bg-brand-dark flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {preOrderTotal > 0 && (
              <div className="mt-4 p-4 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
                <p className="text-sm font-bold text-brand-primary">Pre-order total: ₹{preOrderTotal / 100}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Special Requests */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-brand-primary" /> Special Requests</h2>
              <textarea
                value={specialRequests}
                onChange={e => setSpecialRequests(e.target.value)}
                placeholder="Any dietary restrictions, seating preferences, or special arrangements…"
                rows={4}
                className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-brand-primary/20 resize-none"
              />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 mb-3">Occasion (optional)</h3>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map(o => (
                  <button
                    key={o}
                    onClick={() => setOccasion(occasion === o ? "" : o)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                      occasion === o
                        ? "bg-brand-primary text-white border-brand-primary shadow-md"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-brand-primary/40"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Booking Summary</h2>
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Restaurant</span><span className="font-semibold">{restaurant?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Date</span><span className="font-semibold">{selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Time</span><span className="font-semibold">{selectedSlot ? fmtTime(selectedSlot.slotStart) : "—"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Guests</span><span className="font-semibold">{partySize}</span></div>
              {occasion && <div className="flex justify-between text-sm"><span className="text-zinc-500">Occasion</span><span className="font-semibold">{occasion}</span></div>}
              {specialRequests && <div className="flex justify-between text-sm gap-4"><span className="text-zinc-500 shrink-0">Requests</span><span className="font-semibold text-right">{specialRequests}</span></div>}
              {preOrderTotal > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-500">Pre-order</span><span className="font-semibold text-brand-primary">₹{preOrderTotal / 100}</span></div>}
              {depositPaise > 0 && (
                <div className="pt-3 border-t border-zinc-100 flex justify-between text-sm">
                  <span className="text-zinc-500">Deposit (adjustable at venue)</span>
                  <span className="font-bold text-zinc-900">₹{depositPaise / 100}</span>
                </div>
              )}
            </div>

            {depositPaise > 0 && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-sm text-amber-800">
                A refundable deposit of ₹{depositPaise / 100} is required to confirm your booking. It will be adjusted against your bill at the restaurant.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-black/5 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto">
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="w-full bg-brand-primary text-white py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:shadow-none"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={placing}
              className="w-full bg-brand-primary text-white py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50"
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm Booking</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
