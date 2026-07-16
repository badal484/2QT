import { motion } from 'framer-motion';
import { BadgePercent, Flame, ShieldCheck, Timer } from 'lucide-react';

const CARDS = [
  {
    icon: BadgePercent,
    title: 'No Platform Fee',
    description: 'Every other app charges ₹5–₹30 per order. We don\'t. The price you see is the price you pay.',
    gradient: 'from-brand-primary/20 to-brand-primary/5',
    iconColor: 'text-brand-primary',
    iconBg: 'bg-brand-primary/15',
    border: 'hover:border-brand-primary/30',
    delay: 0.05,
  },
  {
    icon: Flame,
    title: 'Always Fresh',
    description: 'We start cooking after you tap Order. No pre-cooked batches sitting in warmers.',
    gradient: 'from-orange-400/20 to-orange-400/5',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-400/15',
    border: 'hover:border-orange-400/30',
    delay: 0.1,
  },
  {
    icon: ShieldCheck,
    title: 'Hygienic Kitchen',
    description: 'FSSAI certified. Daily sanitisation. No shortcuts, because your health isn\'t negotiable.',
    gradient: 'from-emerald-400/20 to-emerald-400/5',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-400/15',
    border: 'hover:border-emerald-400/30',
    delay: 0.15,
  },
  {
    icon: Timer,
    title: 'Campus-Fast Delivery',
    description: 'Our kitchens are positioned near campus gates. Hot food in 30 minutes, or we fix it.',
    gradient: 'from-blue-400/20 to-blue-400/5',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-400/15',
    border: 'hover:border-blue-400/30',
    delay: 0.2,
  },
];

export function Showcase() {
  return (
    <section id="showcase-section" className="py-24 bg-zinc-950 relative overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold text-brand-primary uppercase tracking-[0.18em] mb-3"
          >
            The 2QT Promise
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.06 }}
            className="text-4xl md:text-5xl font-extrabold font-serif tracking-tight text-white"
          >
            Food delivery,{' '}
            <span className="text-brand-primary">redesigned for students.</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CARDS.map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: card.delay, ease: [0.16, 1, 0.3, 1] }}
              className={`relative group bg-gradient-to-b ${card.gradient} rounded-3xl p-7 border border-white/[0.07] ${card.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] overflow-hidden`}
            >
              {/* Top shine */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className={`w-12 h-12 rounded-2xl ${card.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold font-serif text-white mb-2.5 tracking-tight">{card.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
