import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Heart, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Showcase() {
  const cards = [
    {
      title: "No Platform Fee",
      description: "Why pay extra? We believe in transparent pricing tailored for students.",
      icon: ShieldCheck,
      delay: 0.1
    },
    {
      title: "Fresh Kitchen",
      description: "Every meal is prepared fresh after you order. No frozen shortcuts.",
      icon: Heart,
      delay: 0.2
    },
    {
      title: "Hygienic Cooking",
      description: "Our kitchens adhere to strict 5-star cleanliness and safety standards.",
      icon: CheckCircle2,
      delay: 0.3
    },
    {
      title: "Fast Delivery",
      description: "Hot food delivered to your campus gate faster than you can finish a lecture.",
      icon: Zap,
      delay: 0.4
    }
  ];

  return (
    <section className="py-24 bg-zinc-950 relative">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold font-serif tracking-tight text-white mb-4"
          >
            The 2QT Promise
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            We're changing how food tech works. By students, for students.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: card.delay, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:shadow-[0_8px_30px_rgba(255,107,53,0.1)] hover:-translate-y-1 hover:border-brand-primary/30 transition-all duration-300 backdrop-blur-md"
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-zinc-800 shadow-sm mb-6">
                <card.icon className="w-6 h-6 text-brand-primary shadow-[0_0_15px_rgba(255,107,53,0.5)] rounded-full" />
              </div>
              <h3 className="text-xl font-bold font-serif text-white mb-3">{card.title}</h3>
              <p className="text-zinc-400 font-medium leading-relaxed">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
