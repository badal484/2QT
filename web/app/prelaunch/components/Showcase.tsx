import { motion } from 'framer-motion';
import { BadgePercent, Flame, ShieldCheck, Timer } from 'lucide-react';

const CARDS = [
  {
    icon: BadgePercent,
    title: 'No Platform Fee',
    description: 'Every other app charges ₹5–₹30 per order. We don\'t. The price you see is the price you pay.',
    bg: 'bg-brand-accent',
    iconColor: 'text-brand-dark',
    iconBg: 'bg-white',
    delay: 0.05,
  },
  {
    icon: Flame,
    title: 'Always Fresh',
    description: 'We start cooking after you tap Order. No pre-cooked batches sitting in warmers.',
    bg: 'bg-orange-300',
    iconColor: 'text-brand-dark',
    iconBg: 'bg-white',
    delay: 0.1,
  },
  {
    icon: ShieldCheck,
    title: 'Hygienic Kitchen',
    description: 'FSSAI certified. Daily sanitisation. No shortcuts, because your health isn\'t negotiable.',
    bg: 'bg-emerald-300',
    iconColor: 'text-brand-dark',
    iconBg: 'bg-white',
    delay: 0.15,
  },
  {
    icon: Timer,
    title: 'Campus-Fast Delivery',
    description: 'Our kitchens are positioned near campus gates. Hot food in 30 minutes, or we fix it.',
    bg: 'bg-blue-300',
    iconColor: 'text-brand-dark',
    iconBg: 'bg-white',
    delay: 0.2,
  },
];

export function Showcase() {
  return (
    <section id="showcase-section" className="py-24 bg-[#FFF7ED] relative overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#1A1A1A 1px, transparent 1px), linear-gradient(90deg, #1A1A1A 1px, transparent 1px)',
          backgroundSize: '40px 40px',
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
            className="text-4xl md:text-5xl font-black font-serif tracking-tight text-brand-dark"
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
              className={`relative group ${card.bg} p-7 border-4 border-brand-dark transition-all duration-300 hover:-translate-y-2 hover:translate-x-2 shadow-[8px_8px_0px_#1A1A1A] overflow-hidden`}
            >

              <div className={`w-14 h-14 border-2 border-brand-dark ${card.iconBg} flex items-center justify-center mb-5 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_#1A1A1A]`}>
                <card.icon className={`w-7 h-7 ${card.iconColor}`} />
              </div>
              <h3 className="text-xl font-black font-serif text-brand-dark mb-2.5 tracking-tight uppercase">{card.title}</h3>
              <p className="text-sm text-brand-dark/80 font-semibold leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
