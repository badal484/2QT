'use client';
import { motion } from 'framer-motion';

export function VerticalSidebar() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1, duration: 1 }}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-8 py-10 px-2 border-l border-white/10 bg-white/5 backdrop-blur-xl rounded-l-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.2)]"
    >
      <p 
        className="text-[10px] font-black tracking-[0.4em] text-zinc-500 uppercase flex items-center gap-6"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        <span className="hover:text-white transition-colors cursor-default">Zero Commissions</span>
        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(255,90,31,0.8)]"></span>
        <span className="text-white drop-shadow-md cursor-default">Our Own Kitchen</span>
        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(255,90,31,0.8)]"></span>
        <span className="hover:text-white transition-colors cursor-default">August 2026</span>
      </p>
    </motion.div>
  );
}
