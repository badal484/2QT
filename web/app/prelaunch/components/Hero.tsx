'use client';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, MapPin } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-[#FFFBF7] px-5 py-24">

      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,87,34,0.12) 0%, transparent 65%)' }} />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(244,211,94,0.15) 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto w-full">
        <div className="grid lg:grid-cols-[1fr_420px] gap-16 items-center">

          {/* ── Text ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
              style={{ background: '#FFF3E0', borderColor: '#FFCCBC', color: '#E64A19' }}
            >
              <MapPin className="h-3.5 w-3.5" />
              Launching August 2026 · Lalpur, Ranchi
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.07, ease }}
              className="font-serif font-black tracking-tight leading-[1.06] text-[#1C1C1E]"
              style={{ fontSize: 'clamp(2.8rem, 7vw, 5rem)' }}
            >
              Real food.<br />
              <span style={{ color: '#FF5722' }}>Honest price.</span><br />
              No shortcuts.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease }}
              className="mt-6 max-w-md text-base leading-relaxed text-[#6B7280]"
            >
              Our own kitchen. Experienced chefs. You pay food price + delivery + GST —
              nothing else. Quality and hygiene fully under our control.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.23, ease }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <motion.button
                onClick={onStart}
                whileHover={{ scale: 1.02, boxShadow: '0 12px 32px rgba(255,87,34,0.42)' }}
                whileTap={{ scale: 0.97 }}
                className="group flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-base font-bold text-white transition-shadow"
                style={{ background: 'linear-gradient(135deg,#FF5722,#E64A19)', boxShadow: '0 6px 24px rgba(255,87,34,0.32)' }}
              >
                Claim ₹100 Early Reward
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
              <motion.button
                onClick={() => document.getElementById('why-us')?.scrollIntoView({ behavior: 'smooth' })}
                whileHover={{ borderColor: '#FF5722', color: '#FF5722' }}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#E5E7EB] px-6 py-4 text-sm font-semibold text-[#374151] transition-colors"
              >
                See how it works
              </motion.button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="mt-4 text-xs text-[#9CA3AF]"
            >
              No spam · First 1,000 sign-ups get ₹100 wallet credit on launch day
            </motion.p>

            {/* Mini stats */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, ease }}
              className="mt-10 flex items-center gap-8"
            >
              {[
                { v: '₹0', l: 'Platform fee' },
                { v: '100%', l: 'Own kitchen' },
                { v: '₹100', l: 'Launch reward' },
              ].map(s => (
                <div key={s.l}>
                  <p className="text-2xl font-black font-serif" style={{ color: '#FF5722' }}>{s.v}</p>
                  <p className="text-xs text-[#9CA3AF] font-medium mt-0.5">{s.l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Visual card ── */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 20 }} animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="hidden lg:block"
          >
            <div className="relative">
              {/* Floating chips */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -left-10 top-8 z-10 rounded-2xl border border-orange-100 bg-white px-4 py-2.5 shadow-xl"
              >
                <p className="text-xs text-[#9CA3AF]">Status</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-sm font-bold text-[#1C1C1E]">Cooking now</p>
                </div>
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
                className="absolute -right-8 bottom-12 z-10 rounded-2xl border border-emerald-100 bg-white px-4 py-2.5 shadow-xl"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-bold text-[#1C1C1E]">Zero platform fee</p>
                </div>
              </motion.div>

              {/* Order card */}
              <div className="rounded-3xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.1)] border border-[#F3F4F6]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-bold text-[#1C1C1E] text-sm">Your Order</span>
                  <span className="rounded-full flex items-center gap-1.5 px-3 py-1 text-xs font-bold" style={{ background: '#FFF3E0', color: '#E64A19' }}>
                    <Clock className="h-3 w-3" /> 28 min
                  </span>
                </div>

                <div className="space-y-3 border-b border-[#F9FAFB] pb-4">
                  {[
                    ['Dal Makhani + Rice', '₹120'],
                    ['Paneer Butter Masala', '₹150'],
                    ['Tandoori Roti x3', '₹45'],
                  ].map(([n, p]) => (
                    <div key={n} className="flex justify-between text-sm">
                      <span className="text-[#4B5563]">{n}</span>
                      <span className="font-semibold text-[#1C1C1E]">{p}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  {[
                    { l: 'Food total', v: '₹315', green: false },
                    { l: 'Delivery fee', v: '₹25', green: false },
                    { l: 'GST (5%)', v: '₹17', green: false },
                    { l: 'Platform fee', v: '₹0', green: true },
                  ].map(({ l, v, green }) => (
                    <div key={l} className="flex justify-between">
                      <span className="text-[#9CA3AF]">{l}</span>
                      <span className={`font-semibold ${green ? 'text-emerald-500' : 'text-[#1C1C1E]'}`}>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#F3F4F6] pt-3 font-black text-base text-[#1C1C1E]">
                    <span>Total</span><span>₹357</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
