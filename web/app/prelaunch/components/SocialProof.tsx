import { motion } from 'framer-motion';
import { ChefHat, IndianRupee, MapPin, ShieldCheck } from 'lucide-react';

const STATS = [
  {
    icon: MapPin,
    value: 'Lalpur',
    label: 'Ranchi, Jharkhand',
    sub: 'Our first kitchen location',
    bg: 'bg-brand-primary',
    textColor: 'text-white',
  },
  {
    icon: IndianRupee,
    value: '₹0',
    label: 'Platform Fee',
    sub: 'Food + delivery + tax only',
    bg: 'bg-emerald-300',
    textColor: 'text-brand-dark',
  },
  {
    icon: ShieldCheck,
    value: '100%',
    label: 'In-House Kitchen',
    sub: 'Full control. No middlemen.',
    bg: 'bg-blue-300',
    textColor: 'text-brand-dark',
  },
  {
    icon: ChefHat,
    value: 'Free',
    label: 'Meal on Launch Day',
    sub: 'For first 1,000 members',
    bg: 'bg-brand-accent',
    textColor: 'text-brand-dark',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 bg-[#FFF7ED] relative border-t-4 border-brand-dark overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#1A1A1A 1px, transparent 1px)',
          backgroundSize: '100% 40px',
        }}
      />

      <div className="container mx-auto px-6 max-w-5xl relative z-10">

        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold text-brand-primary uppercase tracking-[0.18em] mb-3"
          >
            By the numbers
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.06 }}
            className="text-3xl md:text-4xl font-black font-serif tracking-tight text-brand-dark"
          >
            Built for Ranchi. Built with honesty.
          </motion.h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center p-6 bg-white border-4 border-brand-dark shadow-[6px_6px_0px_#1A1A1A] hover:-translate-y-2 hover:translate-x-2 transition-all duration-300 group"
            >
              <div className={`w-14 h-14 ${s.bg} border-2 border-brand-dark flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_#1A1A1A]`}>
                <s.icon className={`w-7 h-7 ${s.bg === 'bg-brand-primary' ? 'text-white' : 'text-brand-dark'}`} />
              </div>
              <p className="text-4xl md:text-5xl font-black font-serif tracking-tighter text-brand-dark mb-1">
                {s.value}
              </p>
              <p className="text-sm font-bold text-brand-dark uppercase">{s.label}</p>
              <p className="text-xs text-brand-dark/70 font-semibold mt-0.5">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Pricing transparency callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 bg-brand-dark text-white border-4 border-brand-dark shadow-[8px_8px_0px_#FF6B35] p-7 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent mb-1">Pricing, simplified</p>
            <p className="text-2xl font-black font-serif tracking-tight">
              Food price + Delivery fee + GST
            </p>
            <p className="text-brand-primary font-black text-2xl mt-0.5">= What you pay. Nothing more.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm font-bold min-w-fit">
            <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No platform fee</div>
            <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No surge pricing</div>
            <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No packaging fee</div>
            <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No hidden charges</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
