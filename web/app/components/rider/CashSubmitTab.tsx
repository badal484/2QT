"use client";

import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote, Building2, Smartphone, ShieldCheck, CheckCircle2, Clock, Info, Loader2 } from "lucide-react";

type Method = "physical" | "razorpay";

export default function CashSubmitTab() {
  const [method, setMethod] = useState<Method>("physical");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmedTotal, setConfirmedTotal] = useState("");

  const fetchData = async () => {
    try {
      const res = await api.get("/riders/cash-in-hand");
      setData(res);
    } catch (e: any) {
      toast.error(e.message || "Failed to load cash data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const orders = data?.orders || [];
  const totalPaise = data?.totalPaise || 0;
  const overLimit = data?.overLimit || false;
  const totalRupees = (totalPaise / 100).toFixed(0);
  const pendingSubmission = data?.pendingSubmission || null;

  const handlePhysicalSubmit = async () => {
    if (!orders.length) return;
    setSubmitting(true);
    try {
      await api.post("/riders/submit-all-cash", {
        orderIds: orders.map((o: any) => o.id),
        method: "physical",
      });
      setSubmitted(true);
    } catch (e: any) {
      if (e.response?.status === 409) {
        // Backend rejected duplicate — refresh so the pending submission UI appears
        await fetchData();
      } else {
        toast.error(e.response?.data?.error || e.message || "Could not submit. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpayPay = async () => {
    if (!orders.length) return;
    setRzpLoading(true);
    
    try {
      // 1. Load Razorpay script if not loaded
      if (!(window as any).Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }

      // 2. Create order
      const orderRes = await api.post("/riders/create-cash-order", {});

      // 3. Open Razorpay
      const options = {
        key: orderRes.key,
        amount: orderRes.amount,
        currency: "INR",
        name: "2QT Food",
        description: `Cash handover — ${orderRes.orderCount} order${orderRes.orderCount > 1 ? "s" : ""}`,
        order_id: orderRes.rzpOrderId,
        prefill: {
          name: orderRes.riderName,
          contact: orderRes.riderPhone,
        },
        theme: { color: "#FC4603" },
        handler: async function (response: any) {
          try {
            await api.post("/riders/confirm-cash-payment", {
              submissionId: orderRes.submissionId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });
            setConfirmedTotal((orderRes.amount / 100).toFixed(0));
            setMethod("razorpay");
            setSubmitted(true);
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error(response.error.description || "Payment failed");
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || "Failed to initiate payment");
    } finally {
      setRzpLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  // Already submitted — show awaiting confirmation UI (prevents re-submission on refresh)
  if (!submitted && pendingSubmission) {
    const submittedRupees = (parseInt(pendingSubmission.total_amount_paise) / 100).toFixed(0);
    const submittedAt = new Date(pendingSubmission.submitted_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-24 h-24 rounded-full border-2 bg-amber-500/10 border-amber-500/30 text-amber-400 flex items-center justify-center mb-6">
          <Clock className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Already Submitted</h2>
        <p className="text-5xl font-black text-amber-400 mb-4">₹{submittedRupees}</p>
        <p className="text-zinc-400 text-sm mb-2 max-w-xs">
          You submitted {pendingSubmission.order_count} order{pendingSubmission.order_count !== 1 ? "s" : ""} at {submittedAt}.
          Please hand over the cash at the finance desk.
        </p>
        <p className="text-zinc-500 text-xs mb-6 max-w-xs">Your badge will clear once finance confirms receipt.</p>
        <div className="bg-zinc-900 rounded-full px-4 py-2 border border-white/10">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Pending Finance Confirmation</span>
        </div>
      </motion.div>
    );
  }

  if (submitted) {
    const isRzp = method === "razorpay";
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center mb-6 ${isRzp ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
          {isRzp ? <ShieldCheck className="w-12 h-12" /> : <Clock className="w-12 h-12" />}
        </div>
        <h2 className="text-2xl font-black text-white mb-2">{isRzp ? "Payment Confirmed!" : "Finance Notified"}</h2>
        <p className={`text-5xl font-black mb-4 ${isRzp ? "text-green-400" : "text-amber-400"}`}>₹{confirmedTotal || totalRupees}</p>
        <p className="text-zinc-400 text-sm mb-6 max-w-xs">
          {isRzp
            ? "Your payment has been verified. Your cash badge has been cleared automatically."
            : "Please hand over the cash at the finance desk. Your badge will clear once finance confirms receipt."}
        </p>
        <div className="bg-zinc-900 rounded-full px-4 py-2 border border-white/10">
          <span className={`text-xs font-bold uppercase tracking-widest ${isRzp ? "text-green-400" : "text-amber-400"}`}>
            {isRzp ? "Verified via Razorpay" : "Pending Finance Confirmation"}
          </span>
        </div>
      </motion.div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 bg-green-500/10 rounded-full border border-green-500/20 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-xl font-black text-white">No cash to submit</h2>
        <p className="text-zinc-500 text-sm mt-2">All your COD orders have been settled.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-12 space-y-6">
      {overLimit && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-400 leading-snug">
            You've hit the cash limit. Submit now to resume receiving COD orders.
          </p>
        </div>
      )}

      {/* Total Card */}
      <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden">
        <div className="w-14 h-14 bg-zinc-900 rounded-2xl border border-amber-500/30 flex items-center justify-center mb-4">
          <Banknote className="w-7 h-7 text-amber-400" />
        </div>
        <p className="text-xs font-black text-amber-500/60 uppercase tracking-widest mb-1">Total Cash in Hand</p>
        <p className="text-6xl font-black text-amber-400 tracking-tighter">₹{totalRupees}</p>
        <p className="text-sm text-zinc-400 font-semibold mt-2">{orders.length} COD order{orders.length > 1 ? "s" : ""}</p>
      </div>

      {/* Orders List */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1 mb-3">Pending Orders</h3>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-3">
          {orders.map((order: any) => (
            <div key={order.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm font-bold text-white">{order.display_id}</span>
              </div>
              <span className="text-sm font-black text-white">₹{(order.total_amount_paise / 100).toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Method Selection */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1 mb-3">Submission Method</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setMethod("physical")}
            className={`flex-1 flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${method === "physical" ? "bg-orange-500/10 border-orange-500" : "bg-zinc-900 border-white/5 opacity-60"}`}
          >
            <Building2 className={`w-6 h-6 mb-2 ${method === "physical" ? "text-orange-400" : "text-zinc-500"}`} />
            <span className={`text-sm font-black ${method === "physical" ? "text-white" : "text-zinc-400"}`}>Finance Desk</span>
            <span className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-wider">Hand over cash</span>
          </button>
          <button
            onClick={() => setMethod("razorpay")}
            className={`flex-1 flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${method === "razorpay" ? "bg-orange-500/10 border-orange-500" : "bg-zinc-900 border-white/5 opacity-60"}`}
          >
            <Smartphone className={`w-6 h-6 mb-2 ${method === "razorpay" ? "text-orange-400" : "text-zinc-500"}`} />
            <span className={`text-sm font-black ${method === "razorpay" ? "text-white" : "text-zinc-400"}`}>Pay Online</span>
            <span className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-wider">GPay / Card</span>
          </button>
        </div>
      </div>

      {/* Contextual Action Area */}
      <AnimatePresence mode="popLayout">
        {method === "physical" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4">
              {['Walk to the finance desk at your kitchen', `Hand over ₹${totalRupees} cash`, 'Tap below to notify finance'].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-black">{i + 1}</div>
                  <span className="text-sm font-medium text-zinc-300">{step}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handlePhysicalSubmit}
              disabled={submitting}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "I've Handed Over the Cash"}
            </button>
          </motion.div>
        )}

        {method === "razorpay" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="bg-[#072654] border border-[#C7D7F5]/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#C7D7F5]" />
                <span className="font-black text-white">Secure via Razorpay</span>
              </div>
              <p className="text-sm text-[#C7D7F5] leading-relaxed font-medium">
                Pay ₹{totalRupees} instantly using GPay, PhonePe, Paytm, UPI, Debit / Credit card or Net Banking.
                Your badge clears automatically once the payment is confirmed.
              </p>
            </div>
            <button
              onClick={handleRazorpayPay}
              disabled={rzpLoading}
              className="w-full bg-[#072654] hover:bg-[#0a387c] text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {rzpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay ₹{totalRupees} Online</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
