'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export function FloatingQualityBadge() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="fixed right-0 top-1/3 z-50 flex items-center hidden md:flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div 
        className="bg-black/40 backdrop-blur-2xl border border-white/10 border-r-0 rounded-l-2xl shadow-[-10px_0_30px_rgba(255,90,31,0.15)] flex items-center cursor-pointer overflow-hidden"
        initial={{ width: '3.5rem' }}
        animate={{ width: isHovered ? '22rem' : '3.5rem' }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        <div className="w-14 h-14 shrink-0 flex items-center justify-center text-brand-primary relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-transparent opacity-50" />
          <ShieldCheck className="w-6 h-6 relative z-10 drop-shadow-[0_0_8px_rgba(255,90,31,0.8)]" />
        </div>
        
        <div className="pl-4 pr-6 py-3 shrink-0 w-[18.5rem]">
          <h4 className="font-display font-bold text-white text-sm mb-1 drop-shadow-sm">Zero Restaurant Roulette</h4>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            Not a marketplace. We own the kitchen to guarantee 100% uncompromising quality and taste on every single order.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
