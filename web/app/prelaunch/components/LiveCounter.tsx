import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export function LiveCounter() {
  const [count, setCount] = useState(872); // Fallback start
  const springValue = useSpring(0, { stiffness: 50, damping: 20 });
  const displayValue = useTransform(springValue, Math.round);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/proxy/prelaunch/stats');
        const data = await res.json();
        if (data?.success && typeof data.count === 'number') {
          setCount(Math.max(data.count, 872));
        }
      } catch (e) {}
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    springValue.set(count);
  }, [count, springValue]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.8 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div className="bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_0_30px_rgba(255,90,31,0.2)] rounded-full px-5 py-2.5 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse drop-shadow-[0_0_5px_rgba(255,90,31,0.8)]" />
        <div className="flex items-center gap-1.5 text-sm font-bold text-white drop-shadow-sm">
          <motion.span>{displayValue}</motion.span>
          <span className="text-zinc-400 font-medium">/ 1,000 Rewards Claimed</span>
        </div>
      </div>
    </motion.div>
  );
}
