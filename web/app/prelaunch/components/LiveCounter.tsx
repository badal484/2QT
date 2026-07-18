import React from 'react';
import { motion } from 'framer-motion';

export function LiveCounter() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.8 }}
      className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div className="bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_0_30px_rgba(255,90,31,0.2)] rounded-full px-5 py-2.5 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse drop-shadow-[0_0_5px_rgba(255,90,31,0.8)]" />
        <div className="flex items-center gap-1.5 text-sm font-bold text-white drop-shadow-sm">
          <span className="text-zinc-300 font-medium">Waitlist filling up fast</span>
        </div>
      </div>
    </motion.div>
  );
}
