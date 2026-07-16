import { motion } from 'framer-motion';
import { CalendarDays, MapPin, Sparkles } from 'lucide-react';

export function Countdown() {
  return (
    <section className="py-24 bg-[#FFF7ED] relative overflow-hidden border-t-4 border-brand-dark">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-brand-primary rounded-full blur-[120px] -translate-y-1/2" />
      </div>

      <div className="container mx-auto px-6 max-w-4xl relative z-10 text-center">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent border-2 border-brand-dark text-brand-dark text-sm font-bold uppercase tracking-widest mb-8 shadow-[4px_4px_0px_#1A1A1A] rotate-[-1deg]"
        >
          <Sparkles className="w-4 h-4" />
          Ranchi is about to eat better
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-black font-serif text-brand-dark tracking-tight mb-4"
        >
          One kitchen. One standard.{' '}
          <span className="text-brand-primary">No compromise.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-base md:text-lg text-zinc-600 font-medium max-w-xl mx-auto mb-10"
        >
          We're not just another food app. We own the kitchen, employ the chefs,
          and handle every delivery. If something's wrong, there's no one else to blame — and that's exactly how we like it.
        </motion.p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center gap-3 bg-white border-4 border-brand-dark px-8 py-5 shadow-[6px_6px_0px_#1A1A1A] rotate-[1deg]"
          >
            <CalendarDays className="w-6 h-6 text-brand-primary" />
            <span className="text-2xl md:text-3xl font-black text-brand-dark tracking-tight">
              August <span className="text-brand-primary">2026</span>
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, type: 'spring' }}
            className="inline-flex items-center gap-3 bg-brand-dark border-4 border-brand-dark px-8 py-5 shadow-[6px_6px_0px_#FF6B35] rotate-[-1deg]"
          >
            <MapPin className="w-6 h-6 text-brand-accent" />
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Lalpur, <span className="text-brand-accent">Ranchi</span>
            </span>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 }}
          className="text-brand-dark/70 font-bold uppercase tracking-widest text-xs"
        >
          Register now — your ₹100 wallet credit is waiting when we open doors.
        </motion.p>
      </div>
    </section>
  );
}
