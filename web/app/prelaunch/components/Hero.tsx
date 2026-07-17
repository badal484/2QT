'use client';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Users, Zap, Gift } from 'lucide-react';
import Image from 'next/image';

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden bg-transparent px-4 sm:px-6 lg:px-20 pt-32 pb-12 text-center">
      
      {/* Background Floating Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Glow Orbs */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]"
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col items-center">
        
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-5 py-2 text-sm font-bold text-brand-primary shadow-[0_0_20px_rgba(255,90,31,0.25)] backdrop-blur-md"
        >
          <Zap className="h-4 w-4 fill-brand-primary drop-shadow-[0_0_5px_rgba(255,90,31,0.5)]" />
          First 1,000 users get ₹100 on launch day
        </motion.div>

        {/* Massive Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1, ease }}
          className="font-display font-black tracking-tighter leading-[1.05] text-white drop-shadow-lg mb-6"
          style={{ fontSize: 'clamp(3.5rem, 8vw, 6.5rem)' }}
        >
          Skip the line.<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary via-orange-400 to-amber-300 drop-shadow-[0_0_30px_rgba(255,90,31,0.5)]">
            Eat like a VIP.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease }}
          className="text-lg md:text-xl leading-relaxed text-zinc-300 font-medium max-w-2xl mb-12"
        >
          2QT is Ranchi's fastest food delivery — launching soon. Register now, complete a quick survey, and get <span className="text-amber-400 font-bold">₹100 in your wallet</span> the moment we go live. Only 1,000 spots.
        </motion.p>

        {/* Central Glassmorphic Entry Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease }}
          className="w-full max-w-md bg-white/5 backdrop-blur-3xl rounded-[2rem] p-2 shadow-[0_0_50px_rgba(255,90,31,0.15)] border border-white/10 relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[2rem] pointer-events-none" />
          
          <div className="p-6 md:p-8 flex flex-col items-center">
            <div className="flex items-center gap-3 mb-6 text-zinc-400 font-semibold text-sm">
              <Users className="w-5 h-5 text-brand-primary" />
              <span>Over 8,000 students already waiting</span>
            </div>

            <button
              onClick={onStart}
              className="w-full relative overflow-hidden group/btn rounded-2xl bg-brand-primary px-8 py-5 text-lg font-bold text-white transition-all shadow-[0_0_30px_rgba(255,90,31,0.4)] hover:shadow-[0_0_50px_rgba(255,90,31,0.6)] hover:scale-[1.02] active:scale-[0.98]"
            >
              {/* Button Shine Effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover/btn:animate-[shimmer_1.5s_infinite]" />
              
              <span className="relative flex items-center justify-center gap-3">
                Secure Your Spot
                <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
              </span>
            </button>

            <div className="mt-5 flex items-center gap-2 text-xs font-medium text-zinc-500">
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Top 100 get lifetime VIP status</span>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
