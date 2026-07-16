import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

function AnimatedCounter({ value, duration = 2 }: { value: number, duration?: number }) {
  const springValue = useSpring(0, { stiffness: 50, damping: 20 });
  const displayValue = useTransform(springValue, Math.round);

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return <motion.span>{displayValue}</motion.span>;
}

export function SocialProof() {
  return (
    <section className="py-24 bg-zinc-50 relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          
          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-5xl md:text-6xl font-black text-brand-primary mb-2 tracking-tighter"
            >
              <AnimatedCounter value={1000} />+
            </motion.div>
            <p className="font-semibold text-zinc-900">Launch Rewards</p>
            <p className="text-sm text-zinc-500 mt-1">Claimed so far</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-black text-zinc-900 mb-2 tracking-tighter"
            >
              100%
            </motion.div>
            <p className="font-semibold text-zinc-900">Student Focused</p>
            <p className="text-sm text-zinc-500 mt-1">Built for your budget</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-6xl font-black text-zinc-900 mb-2 tracking-tighter"
            >
              <AnimatedCounter value={0} />
            </motion.div>
            <p className="font-semibold text-zinc-900">Platform Fees</p>
            <p className="text-sm text-zinc-500 mt-1">No hidden charges</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-6xl font-black text-zinc-900 mb-2 tracking-tighter"
            >
              24/7
            </motion.div>
            <p className="font-semibold text-zinc-900">Fresh Every Order</p>
            <p className="text-sm text-zinc-500 mt-1">Premium Packaging</p>
          </div>

        </div>
      </div>
    </section>
  );
}
