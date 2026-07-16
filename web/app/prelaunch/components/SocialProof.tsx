import { motion } from 'framer-motion';
import { ShieldCheck, Zap, IndianRupee, Users } from 'lucide-react';

const STATS = [
  {
    icon: Users,
    value: '1,000',
    label: 'Reward Slots',
    sub: 'Limited availability',
    color: 'text-brand-dark',
    glow: 'shadow-[6px_6px_0px_#1A1A1A]',
    bg: 'bg-brand-primary',
    border: 'border-brand-dark',
  },
  {
    icon: IndianRupee,
    value: '₹100',
    label: 'Free Wallet Credit',
    sub: 'Yours on launch day',
    color: 'text-brand-dark',
    glow: 'shadow-[6px_6px_0px_#1A1A1A]',
    bg: 'bg-emerald-300',
    border: 'border-brand-dark',
  },
  {
    icon: ShieldCheck,
    value: '₹0',
    label: 'Platform Fees',
    sub: 'Forever. Seriously.',
    color: 'text-brand-dark',
    glow: 'shadow-[6px_6px_0px_#1A1A1A]',
    bg: 'bg-blue-300',
    border: 'border-brand-dark',
  },
  {
    icon: Zap,
    value: '30 min',
    label: 'Avg. Delivery',
    sub: 'Hot food, not excuses',
    color: 'text-brand-dark',
    glow: 'shadow-[6px_6px_0px_#1A1A1A]',
    bg: 'bg-brand-accent',
    border: 'border-brand-dark',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 bg-[#FFF7ED] relative border-t-4 border-brand-dark overflow-hidden">
      {/* Subtle lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#1A1A1A 1px, transparent 1px)',
          backgroundSize: '100% 40px',
        }}
      />

      <div className="container mx-auto px-6 max-w-5xl relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`flex flex-col items-center text-center p-6 bg-white border-4 ${s.border} ${s.glow} hover:-translate-y-2 hover:translate-x-2 transition-all duration-300 group`}
            >
              <div className={`w-14 h-14 ${s.bg} border-2 ${s.border} flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_#1A1A1A]`}>
                <s.icon className={`w-7 h-7 ${s.color}`} />
              </div>
              <p className={`text-4xl md:text-5xl font-black font-serif tracking-tighter text-brand-dark mb-1`}>
                {s.value}
              </p>
              <p className="text-sm font-bold text-brand-dark uppercase">{s.label}</p>
              <p className="text-xs text-brand-dark/70 font-semibold mt-0.5">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
