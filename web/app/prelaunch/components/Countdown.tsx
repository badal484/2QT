import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function Countdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set target date 14 days from now for demo purposes
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);
    
    const timer = setInterval(() => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <section className="py-24 bg-zinc-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-12 text-center"
          >
            The clock is ticking.
          </motion.h2>

          <div className="flex gap-4 md:gap-8 justify-center items-center w-full max-w-2xl">
            {Object.entries(timeLeft).map(([label, value], i) => (
              <motion.div 
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center"
              >
                <div className="w-20 h-24 md:w-28 md:h-32 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50" />
                  <span className="text-4xl md:text-6xl font-black tabular-nums tracking-tighter text-white drop-shadow-md relative z-10">
                    {value.toString().padStart(2, '0')}
                  </span>
                </div>
                <span className="mt-4 text-xs md:text-sm font-bold uppercase tracking-widest text-zinc-400">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
