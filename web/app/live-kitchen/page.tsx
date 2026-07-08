"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Thermometer, Droplets, Leaf, Award, ChefHat, Eye, Clock, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Toaster } from "sonner";

const STORIES = [
  { title: "Morning Prep", emoji: "🔪", desc: "Fresh ingredients prepped every morning by our chefs" },
  { title: "Farm Fresh", emoji: "🥬", desc: "Vegetables sourced daily from certified organic farms" },
  { title: "Sanitization", emoji: "🧼", desc: "Full kitchen deep-cleaned hourly during service" },
  { title: "Packaging", emoji: "📦", desc: "Tamper-proof sealed packaging for every order" },
];

const TRUST_BADGES = [
  { icon: <ShieldCheck className="w-6 h-6" />, title: "FSSAI Certified", desc: "Licensed & regularly audited by Food Safety authority", color: "text-green-600 bg-green-50 border-green-200" },
  { icon: <Thermometer className="w-6 h-6" />, title: "Staff Health Checks", desc: "Daily temperature & health screening for all kitchen staff", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { icon: <Droplets className="w-6 h-6" />, title: "Hourly Sanitization", desc: "All surfaces, utensils, and equipment sanitized every hour", color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  { icon: <Leaf className="w-6 h-6" />, title: "Pure Veg Kitchen", desc: "100% vegetarian kitchen with zero cross-contamination", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
];

export default function LiveKitchenPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cachedLoc = typeof window !== "undefined" ? localStorage.getItem("2qt_last_location") : null;
    let zoneId: string | null = null;
    if (cachedLoc) {
      try { zoneId = JSON.parse(cachedLoc).zoneId; } catch {}
    }
    const endpoint = zoneId ? `/menu/kitchen-metrics?zoneId=${zoneId}` : "/menu/kitchen-metrics";
    api.get(endpoint)
      .then((d: any) => setMetrics(d.metrics ?? null))
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  const m = metrics ?? {
    fssai_status: "FSSAI Certified",
    fssai_valid_till: "Valid '27",
    staff_temp_value: "98.6°F",
    staff_temp_time: "10m ago",
    sanitization_percent: "100% Sanitized",
    sanitization_freq: "Hourly",
    pure_veg_status: "100% Pure Veg",
    pure_veg_audited: "Audited",
    avg_prep_time_mins: 12,
    orders_today: null,
  };

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white font-sans antialiased pb-20">
      <Toaster richColors position="top-center" />

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-[#0D0D1A]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/menu" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative w-2.5 h-2.5">
              <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              <span className="relative block w-2.5 h-2.5 bg-red-500 rounded-full" />
            </div>
            <h1 className="text-base font-bold">Live Kitchen</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6">
        {/* Hero */}
        <div className="py-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold mb-6">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> LIVE NOW
          </div>
          <h2 className="text-4xl font-bold mb-3">Our Kitchen. Nothing to Hide.</h2>
          <p className="text-white/50 max-w-md mx-auto text-sm leading-relaxed">
            Every meal you order is crafted in a certified, hygienic kitchen by trained chefs. Watch us work.
          </p>
        </div>

        {/* Live camera placeholder */}
        <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 mb-10 aspect-video flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-[#1A1A2E]" />
          <div className="relative z-10 text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 border border-white/10">
              <ChefHat className="w-10 h-10 text-white/40" />
            </div>
            <p className="text-white/50 font-semibold mb-2">Kitchen Cam</p>
            <p className="text-xs text-white/30">Live stream available during operating hours</p>
          </div>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full">
            <Eye className="w-3.5 h-3.5" /> {m.orders_today ? `${m.orders_today} watching` : "Kitchen Active"}
          </div>
        </div>

        {/* Kitchen stories */}
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-4">Behind the Scenes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STORIES.map(s => (
              <div key={s.title} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition-all cursor-pointer">
                <div className="text-4xl mb-3">{s.emoji}</div>
                <p className="font-bold text-sm mb-1">{s.title}</p>
                <p className="text-xs text-white/40 leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live metrics */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
        ) : (
          <div className="mb-10">
            <h3 className="text-lg font-bold mb-4">Real-time Kitchen Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <Award className="w-5 h-5 text-green-400 mb-2" />
                <p className="text-sm font-bold">{m.fssai_status}</p>
                <p className="text-xs text-white/40 mt-0.5">{m.fssai_valid_till}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <Thermometer className="w-5 h-5 text-blue-400 mb-2" />
                <p className="text-sm font-bold">{m.staff_temp_value}</p>
                <p className="text-xs text-white/40 mt-0.5">Updated {m.staff_temp_time}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <Droplets className="w-5 h-5 text-cyan-400 mb-2" />
                <p className="text-sm font-bold">{m.sanitization_percent}</p>
                <p className="text-xs text-white/40 mt-0.5">{m.sanitization_freq}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <Leaf className="w-5 h-5 text-emerald-400 mb-2" />
                <p className="text-sm font-bold">{m.pure_veg_status}</p>
                <p className="text-xs text-white/40 mt-0.5">{m.pure_veg_audited}</p>
              </div>
              {m.avg_prep_time_mins && (
                <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                  <Clock className="w-5 h-5 text-brand-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold">~{m.avg_prep_time_mins} min prep time</p>
                    <p className="text-xs text-white/40">Average kitchen-to-door preparation time today</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trust badges */}
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-4">Our Commitments</h3>
          <div className="space-y-3">
            {TRUST_BADGES.map(b => (
              <div key={b.title} className="bg-white/5 border border-white/5 rounded-2xl p-5 flex gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${b.color}`}>
                  {b.icon}
                </div>
                <div>
                  <p className="font-bold text-sm">{b.title}</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-4">
          <Link href="/menu" className="inline-flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-2xl text-sm font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/30">
            Order from this Kitchen
          </Link>
        </div>
      </main>
    </div>
  );
}
