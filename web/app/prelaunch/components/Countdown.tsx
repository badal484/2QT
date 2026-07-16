import { motion } from 'framer-motion';
import { Sparkles, CalendarDays } from 'lucide-react';

export function Countdown() {
  return (
    <section className="py-24 bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-brand-primary/20 rounded-full blur-[100px] -translate-y-1/2" />
      </div>

      <div className="container mx-auto px-6 max-w-4xl relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-sm font-bold uppercase tracking-widest mb-8"
        >
          <Sparkles className="w-4 h-4" />
          The Wait is Almost Over
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-extrabold font-serif text-white tracking-tight mb-6"
        >
          Something delicious is cooking.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-8 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] mt-4"
        >
          <CalendarDays className="w-6 h-6 text-brand-primary" />
          <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Launching in <span className="text-brand-primary">August 2026</span>
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-zinc-500 font-medium"
        >
          Register now — your ₹100 reward is waiting when we open doors.
        </motion.p>
      </div>
    </section>
  );
}
