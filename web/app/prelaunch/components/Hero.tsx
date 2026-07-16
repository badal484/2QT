import { motion } from 'framer-motion';
import { ArrowRight, Star, Clock, Heart, UtensilsCrossed } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-white selection:bg-brand-primary/20">
      
      {/* Background ambient blobs (GPU accelerated transforms) */}
      <motion.div 
        animate={{ 
          transform: ['translate(0%, 0%) scale(1)', 'translate(5%, 5%) scale(1.05)', 'translate(0%, 0%) scale(1)'] 
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-primary/10 blur-[100px] pointer-events-none will-change-transform"
      />
      <motion.div 
        animate={{ 
          transform: ['translate(0%, 0%) scale(1)', 'translate(-5%, -5%) scale(1.05)', 'translate(0%, 0%) scale(1)'] 
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear', delay: 2 }}
        className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/30 blur-[100px] pointer-events-none will-change-transform"
      />

      <div className="relative z-10 container mx-auto px-6 pt-20 pb-32 max-w-4xl flex flex-col items-center text-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200/60 shadow-sm mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-sm font-semibold tracking-wide text-zinc-800 uppercase">Coming Soon to Campus</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl md:text-8xl font-black text-zinc-900 tracking-tighter leading-[1.05] mb-8"
        >
          Quality.<br className="md:hidden" /> Quantity.<br className="md:hidden" /> Taste.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl md:text-2xl text-zinc-600 font-medium mb-12 max-w-2xl leading-relaxed"
        >
          Built for students. No platform fee. Freshly cooked. Delivered fast. 
          Join the exclusive waitlist to secure your launch reward.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <button 
            onClick={onStart}
            className="group relative flex w-full sm:w-auto items-center justify-center gap-3 bg-zinc-900 text-white px-8 py-5 rounded-2xl font-bold text-lg hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden"
          >
            <span className="relative z-10">Claim My Launch Reward</span>
            <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            
            {/* Subtle sweep animation */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0" />
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 mt-24 border-t border-zinc-100 pt-12 w-full"
        >
          {[
            { icon: UtensilsCrossed, label: "Freshly Cooked" },
            { icon: Star, label: "No Platform Fee" },
            { icon: Heart, label: "Hygienic Kitchen" },
            { icon: Clock, label: "Fast Delivery" },
          ].map((feature, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-800 shadow-sm">
                <feature.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-zinc-600">{feature.label}</p>
            </div>
          ))}
        </motion.div>
        
      </div>
    </div>
  );
}
