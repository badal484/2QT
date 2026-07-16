import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#FFF7ED] selection:bg-brand-primary/20">

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* Ambient blobs */}
      <motion.div
        animate={{ transform: ['translate(0%,0%) scale(1)', 'translate(6%,8%) scale(1.08)', 'translate(0%,0%) scale(1)'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-brand-primary/10 blur-[120px] pointer-events-none will-change-transform"
      />
      <motion.div
        animate={{ transform: ['translate(0%,0%) scale(1)', 'translate(-6%,-6%) scale(1.06)', 'translate(0%,0%) scale(1)'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear', delay: 3 }}
        className="absolute bottom-[-20%] right-[-15%] w-[55%] h-[55%] rounded-full bg-brand-accent/20 blur-[120px] pointer-events-none will-change-transform"
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[30%] bg-brand-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 container mx-auto px-6 pt-24 pb-36 max-w-4xl flex flex-col items-center text-center">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2.5 px-4 py-2 bg-brand-primary text-white border-2 border-brand-dark mb-7 shadow-[4px_4px_0px_#1A1A1A] rotate-[-2deg]"
        >
          <span className="text-xs font-bold tracking-[0.15em] uppercase">Launching August 2026 · Lalpur, Ranchi</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(3rem,10vw,6rem)] font-black font-serif text-brand-dark tracking-tighter leading-[1.02] mb-6"
        >
          Real food.{' '}
          <span className="relative inline-block px-4 py-1 bg-brand-accent border-4 border-brand-dark shadow-[6px_6px_0px_#1A1A1A] rotate-[1deg] mt-2 lg:mt-0">
            <span className="text-brand-dark">Honest price.</span>
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-zinc-700 font-medium mb-5 max-w-2xl leading-relaxed"
        >
          Built for students, open to everyone in Lalpur, Ranchi.
          Experienced chefs. Our own kitchen. Zero platform fee —
          you pay only food price, delivery & tax. Quality, hygiene, and timing all under our control.
        </motion.p>

        {/* Reward pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.26, type: 'spring', stiffness: 200 }}
          className="flex items-center gap-2.5 bg-white border-2 border-brand-dark px-5 py-3 mb-10 shadow-[4px_4px_0px_#1A1A1A]"
        >
          <div className="flex items-center justify-center w-8 h-8 bg-brand-accent border-2 border-brand-dark">
            <Sparkles className="w-4 h-4 text-brand-dark" />
          </div>
          <span className="text-sm font-bold text-brand-dark">
            Early access →{' '}
            <span className="text-brand-primary font-black">₹100 free</span>
            {' '}in your wallet on launch day
          </span>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <button
            onClick={onStart}
            className="group relative flex w-full sm:w-auto items-center justify-center gap-2.5 overflow-hidden border-2 border-brand-dark bg-brand-primary px-8 py-4 font-bold text-lg text-white shadow-[6px_6px_0px_#1A1A1A] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          >
            <span className="relative">Claim My ₹100 Reward</span>
            <ArrowRight className="relative w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => document.getElementById('showcase-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-8 py-4 font-bold text-base text-brand-dark bg-white border-2 border-brand-dark shadow-[6px_6px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all"
          >
            Why 2QT is different
            <ChevronDown className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-8 text-xs text-brand-dark/70 font-bold uppercase tracking-wider"
        >
          No spam. No hidden fees. Just great food — coming to Ranchi.
        </motion.p>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <ChevronDown className="w-5 h-5 text-zinc-700" />
        </motion.div>
      </motion.div>
    </div>
  );
}
