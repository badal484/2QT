import { motion } from 'framer-motion';
import { ArrowRight, Gift } from 'lucide-react';

export function Countdown({ onStart }: { onStart: () => void }) {

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
          className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mb-10 drop-shadow-md"
        >
          Ranchi's food scene, finally upgraded.
        </motion.h2>

        {/* Big date statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.12 }}
          className="mb-12 select-none"
        >
          <p
            className="font-display font-black text-white leading-none tracking-tighter drop-shadow-2xl"
            style={{ fontSize: 'clamp(4.5rem, 18vw, 10rem)' }}
          >
            AUGUST
          </p>
          <p
            className="font-display font-black text-brand-primary leading-none tracking-tighter drop-shadow-[0_0_40px_rgba(255,90,31,0.6)]"
            style={{ fontSize: 'clamp(2.5rem, 10vw, 6rem)' }}
          >
            2026
          </p>
          <p className="text-zinc-500 text-sm font-medium mt-4 tracking-wide">
            Launching in Lalpur, Ranchi
          </p>
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
            Become a Founding Member. Get a Free Meal.
          </h3>
          <p className="text-sm text-zinc-400 mb-8 font-medium relative z-10">
            Be one of the first 1,000 members and help us decide the menu and offers. Get a free meal the moment 2QT launches.
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
