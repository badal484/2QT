'use client';
import { motion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import Image from 'next/image';

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-transparent px-6 lg:px-20 pt-28 pb-12">
      <div className="relative z-10 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Text ── */}
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-4 py-1.5 text-xs font-bold text-brand-primary shadow-[0_0_15px_rgba(255,90,31,0.2)]"
            >
              <Star className="h-3.5 w-3.5 fill-brand-primary drop-shadow-[0_0_5px_rgba(255,90,31,0.5)]" />
              Exclusive Early Access
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.07, ease }}
              className="font-display font-bold tracking-tight leading-[1.1] text-white drop-shadow-md"
              style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)' }}
            >
              Food delivery,<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-amber-400 drop-shadow-[0_0_20px_rgba(255,90,31,0.4)]">reimagined.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease }}
              className="mt-6 text-lg leading-relaxed text-zinc-400 font-medium max-w-md"
            >
              Join the waitlist to secure your spot for a premium culinary experience. Invite friends to jump the line and unlock exclusive rewards.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.23, ease }}
              className="mt-10"
            >
              <motion.button
                onClick={onStart}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-center justify-center gap-3 rounded-full px-8 py-4 text-sm font-bold text-black transition-all bg-white shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105"
              >
                Claim Your Spot
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </motion.div>
          </div>

          {/* ── Visual ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
            transition={{ opacity: { duration: 0.7, delay: 0.2, ease }, scale: { duration: 0.7, delay: 0.2, ease }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
            className="w-full h-[600px] lg:h-[700px] relative rounded-[3rem] overflow-hidden shadow-[0_0_60px_rgba(255,90,31,0.2)] border border-white/5"
          >
            <Image 
              src="/hero-bowl.png" 
              alt="Mediterranean Quinoa Bowl"
              fill
              className="object-cover"
              priority
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

            {/* Label Overlay */}
            <div className="absolute bottom-10 left-10 right-10">
              <div className="inline-block bg-white/10 backdrop-blur-xl border border-white/20 text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full mb-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                Chef's Signature
              </div>
              <h3 className="text-white font-display font-bold text-2xl tracking-tight mb-2 drop-shadow-md">
                Mediterranean Quinoa Bowl
              </h3>
              <p className="text-white/80 text-sm font-medium">
                Fresh, healthy, and perfectly balanced.
              </p>
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
