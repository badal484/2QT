import { motion } from 'framer-motion';
import { ShieldCheck, Zap, IndianRupee, Users } from 'lucide-react';

const STATS = [
  {
    icon: Users,
    value: '1,000',
    label: 'Reward Slots',
    sub: 'Limited availability',
    color: 'text-brand-primary',
    glow: 'shadow-[0_0_20px_rgba(255,107,53,0.15)]',
    bg: 'bg-brand-primary/10',
    border: 'border-brand-primary/20',
  },
  {
    icon: IndianRupee,
    value: '₹100',
    label: 'Free Wallet Credit',
    sub: 'Yours on launch day',
    color: 'text-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: ShieldCheck,
    value: '₹0',
    label: 'Platform Fees',
    sub: 'Forever. Seriously.',
    color: 'text-blue-400',
    glow: 'shadow-[0_0_20px_rgba(96,165,250,0.15)]',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: Zap,
    value: '30 min',
    label: 'Avg. Delivery',
    sub: 'Hot food, not excuses',
    color: 'text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.15)]',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 bg-zinc-950 relative border-t border-white/[0.04]">
      {/* Subtle center glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(255,107,53,0.04),transparent)] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-5xl relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`flex flex-col items-center text-center p-6 rounded-3xl bg-white/[0.03] border border-white/[0.07] ${s.glow} backdrop-blur-sm hover:border-white/[0.12] transition-all duration-300 group`}
            >
              <div className={`w-11 h-11 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className={`text-3xl md:text-4xl font-black font-serif tracking-tighter ${s.color} mb-1`}>
                {s.value}
              </p>
              <p className="text-sm font-bold text-white">{s.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
