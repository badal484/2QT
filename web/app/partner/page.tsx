"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Store, CheckCircle2, Bike, TrendingUp,
  Phone, Mail, MapPin, Utensils, ArrowRight, IndianRupee
} from "lucide-react";
import { api } from "../lib/api";

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ restaurantName }: { restaurantName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen bg-[#07070e] flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Application Received!</h1>
          <p className="text-white/50 mt-3 leading-relaxed">
            Thanks for applying, <span className="text-white font-bold">{restaurantName}</span>!
            Our team will review your application and reach out within 2 business days.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
          {["Review within 2 days", "Commission rate discussion", "Onboarding & menu setup", "Go live on 2QT"].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black">{i + 1}</div>
              <span className="text-sm text-white/70">{step}</span>
            </div>
          ))}
        </div>
        <a href="/" className="inline-block text-sm text-emerald-400 hover:underline">← Back to 2QT</a>
      </div>
    </motion.div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function PartnerPage() {
  const [form, setForm] = useState({
    restaurantName: "", ownerName: "", phone: "", email: "",
    address: "", city: "", cuisineType: "", fssaiNumber: "",
    expectedDailyOrders: "", upiId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const required = ["restaurantName", "ownerName", "phone", "email", "address", "city"];
    const missing = required.find(k => !form[k as keyof typeof form].trim());
    if (missing) { setError("Please fill in all required fields."); return; }
    if (form.phone.replace(/\D/g, "").length < 10) { setError("Enter a valid phone number."); return; }

    setLoading(true);
    try {
      await api.post("/finance/partners/applications", {
        restaurantName: form.restaurantName,
        ownerName: form.ownerName,
        phone: form.phone.replace(/\D/g, ""),
        email: form.email,
        address: form.address,
        city: form.city,
        cuisineType: form.cuisineType || undefined,
        fssaiNumber: form.fssaiNumber || undefined,
        expectedDailyOrders: form.expectedDailyOrders ? parseInt(form.expectedDailyOrders) : undefined,
        upiId: form.upiId || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return <SuccessScreen restaurantName={form.restaurantName} />;

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#07070e]/90 backdrop-blur-sm z-10">
        <a href="/" className="text-xl font-black">2QT<span className="text-[#F97316]">.</span></a>
        <a href="/menu" className="text-sm text-white/40 hover:text-white transition-colors">Order Now</a>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 bg-[#F97316]/10 border border-[#F97316]/20 rounded-full px-4 py-1.5 text-sm font-semibold text-[#F97316]">
            <Store className="w-4 h-4" /> Partner with 2QT
          </div>
          <h1 className="text-5xl lg:text-6xl font-black tracking-tight">
            Grow your kitchen<br />
            <span className="text-[#F97316]">with 2QT.</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
            Join our delivery network. We handle orders, logistics and payments — you focus on the food.
          </p>
        </motion.div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          {[
            { icon: Bike, title: "We handle delivery", desc: "Our rider network covers your area. Zero logistics overhead for you." },
            { icon: TrendingUp, title: "Grow your revenue", desc: "Tap into 2QT's customer base. More orders, zero marketing spend." },
            { icon: IndianRupee, title: "Weekly payouts", desc: "Transparent commission. Get paid weekly directly to your bank." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#F97316]" />
              </div>
              <div className="font-bold text-white">{title}</div>
              <div className="text-sm text-white/40 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-black">Apply to become a partner</h2>
            <p className="text-white/40 text-sm mt-1">Takes 2 minutes. We'll be in touch within 2 days.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Restaurant */}
            <div className="space-y-1">
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Restaurant Name *</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input value={form.restaurantName} onChange={set("restaurantName")} placeholder="Sharma's Kitchen"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
            </div>

            {/* Owner */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Owner Name *</label>
                <input value={form.ownerName} onChange={set("ownerName")} placeholder="Rahul Sharma"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Phone *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="tel" value={form.phone} onChange={set("phone")} placeholder="9876543210"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Email *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input type="email" value={form.email} onChange={set("email")} placeholder="rahul@kitchen.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Street Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input value={form.address} onChange={set("address")} placeholder="123 MG Road"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">City *</label>
                <input value={form.city} onChange={set("city")} placeholder="Bengaluru"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
            </div>

            {/* Cuisine + FSSAI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Cuisine Type</label>
                <div className="relative">
                  <Utensils className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input value={form.cuisineType} onChange={set("cuisineType")} placeholder="North Indian, Biryani..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">FSSAI License No.</label>
                <input value={form.fssaiNumber} onChange={set("fssaiNumber")} placeholder="10020XXXXXXXXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
            </div>

            {/* Orders + UPI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Expected Daily Orders</label>
                <input type="number" min="1" value={form.expectedDailyOrders} onChange={set("expectedDailyOrders")} placeholder="e.g. 30"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">UPI ID (for payouts)</label>
                <input value={form.upiId} onChange={set("upiId")} placeholder="kitchen@upi"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]/50 placeholder:text-white/20" />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#F97316] text-white font-black text-base hover:bg-[#ea6c08] transition-colors disabled:opacity-50 mt-2">
              {loading ? "Submitting..." : <>Submit Application <ArrowRight className="w-5 h-5" /></>}
            </button>

            <p className="text-xs text-white/20 text-center">
              By submitting, you agree to 2QT's partner terms. Commission rates are discussed during onboarding.
            </p>
          </form>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.05] py-8 text-center text-xs text-white/20">
        © 2026 2QT Culinary. All rights reserved. · <a href="mailto:hello@2qthello.com" className="hover:text-white/40">hello@2qthello.com</a>
      </div>
    </div>
  );
}
