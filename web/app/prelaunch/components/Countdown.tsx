'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export function Countdown({ onStart }: { onStart: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const target = new Date('2026-08-01T00:00:00');
    const tick = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      setTimeLeft({
        days:  Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins:  Math.floor((diff % 3600000)  / 60000),
        secs:  Math.floor((diff % 60000)    / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number, len = 2) => String(n).padStart(len, '0');

  return (
    <section className="py-20 bg-white border-t border-[#F3F4F6]">
      <div className="max-w-4xl mx-auto px-5 text-center">

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{ color: '#FF5722' }}
        >
          Launch Countdown
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.07 }}
          className="text-3xl sm:text-4xl font-black font-serif text-[#1C1C1E] tracking-tight mb-3"
        >
          Ranchi is about to eat better.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.12 }}
          className="text-[#6B7280] text-base mb-12"
        >
          Opening our kitchen in Lalpur, Ranchi on August 1, 2026.
        </motion.p>

        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.16, type: 'spring' }}
          className="grid grid-cols-4 gap-3 sm:gap-5 max-w-lg mx-auto mb-12"
        >
          {[
            { value: pad(timeLeft.days, 3), label: 'Days' },
            { value: pad(timeLeft.hours), label: 'Hours' },
            { value: pad(timeLeft.mins), label: 'Mins' },
            { value: pad(timeLeft.secs), label: 'Secs' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-[#F3F4F6] bg-[#FFFBF7] py-5 px-2 text-center">
              <p className="text-3xl sm:text-5xl font-black font-serif tabular-nums" style={{ color: '#FF5722' }}>{value}</p>
              <p className="text-[10px] sm:text-xs text-[#9CA3AF] font-semibold uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* CTA card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="max-w-md mx-auto rounded-3xl p-7 sm:p-8 border border-orange-100 text-center"
          style={{ background: '#FFFBF7' }}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#FF5722] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-black font-serif text-[#1C1C1E] mb-2">Secure your ₹100 reward</h3>
          <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
            First 1,000 registrations get ₹100 free wallet credit the moment 2QT launches.
            No conditions. No minimum order.
          </p>
          <button
            onClick={onStart}
            className="group w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FF5722, #E64A19)', boxShadow: '0 6px 20px rgba(255,87,34,0.3)' }}
          >
            Register for Early Access
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="mt-3 text-xs text-[#9CA3AF]">No spam. Free to join.</p>
        </motion.div>
      </div>
    </section>
  );
}
