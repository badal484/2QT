'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Gift } from 'lucide-react';

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
    <section className="py-24 bg-transparent border-t border-white/10 relative z-10">
      <div className="max-w-4xl mx-auto px-5 text-center">

        <motion.p
          initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-primary drop-shadow-[0_0_5px_rgba(255,90,31,0.4)]"
        >
          Launch Countdown
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.07 }}
          className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mb-3 drop-shadow-md"
        >
          Ranchi is about to eat better.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.12 }}
          className="text-zinc-400 font-medium text-base mb-12"
        >
          Opening our kitchen in Lalpur, Ranchi on August 1, 2026.
        </motion.p>

        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.16, type: 'spring', stiffness: 90 }}
          className="grid grid-cols-4 gap-3 sm:gap-5 max-w-lg mx-auto mb-14"
        >
          {[
            { value: pad(timeLeft.days, 3), label: 'Days' },
            { value: pad(timeLeft.hours), label: 'Hours' },
            { value: pad(timeLeft.mins), label: 'Mins' },
            { value: pad(timeLeft.secs), label: 'Secs' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg py-6 px-2 text-center"
            >
              <p className="text-3xl sm:text-5xl font-display font-bold tabular-nums text-brand-primary drop-shadow-[0_0_15px_rgba(255,90,31,0.5)]">
                {value}
              </p>
              <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-wider mt-2">
                {label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* CTA card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.25 }}
          className="max-w-md mx-auto rounded-[2rem] p-8 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(255,90,31,0.15)] text-center relative overflow-hidden group"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/20 rounded-full blur-[60px] group-hover:bg-brand-primary/30 transition-colors duration-500"></div>
          
          <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-white/10 border border-white/20 shadow-inner">
            <Gift className="w-6 h-6 text-brand-primary drop-shadow-[0_0_5px_rgba(255,90,31,0.5)]" />
          </div>
          <h3 className="text-xl font-display font-bold text-white mb-2 relative z-10 drop-shadow-sm">
            Secure your ₹100 reward
          </h3>
          <p className="text-sm text-zinc-400 mb-8 font-medium relative z-10">
            First 1,000 registrations get ₹100 free wallet credit the moment 2QT launches.
            No conditions. No minimum order.
          </p>
          <motion.button
            onClick={onStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group/btn relative z-10 w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-full shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] border border-brand-primary/50 transition-all"
            style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}
          >
            Register for Early Access
            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </motion.button>
          <p className="mt-4 text-xs font-semibold text-zinc-500 relative z-10">No spam. Free to join.</p>
        </motion.div>
      </div>
    </section>
  );
}
