import { motion } from 'framer-motion';
import { BadgePercent, ChefHat, ShieldCheck, Timer, UtensilsCrossed } from 'lucide-react';

const CARDS = [
  {
    icon: UtensilsCrossed,
    title: 'Our Own Kitchen',
    description: 'We operate from our own kitchen in Lalpur, Ranchi — giving us full control over every ingredient, every dish, and every delivery. No third-party cloud kitchens.',
    bg: 'bg-brand-accent',
    delay: 0.05,
  },
  {
    icon: ChefHat,
    title: 'Experienced Chefs',
    description: 'Our professional chefs bring real culinary expertise to every plate. Consistent taste, correct portions, and quality you can taste — order after order.',
    bg: 'bg-orange-300',
    delay: 0.1,
  },
  {
    icon: ShieldCheck,
    title: 'Hygiene Guaranteed',
    description: 'Because we run our own kitchen, hygiene is non-negotiable. Daily sanitisation, FSSAI-compliant practices, and zero shortcuts — we eat here too.',
    bg: 'bg-emerald-300',
    delay: 0.15,
  },
  {
    icon: Timer,
    title: 'On Time, Every Time',
    description: 'We own the kitchen and the delivery. No excuses. Your food leaves our kitchen hot and arrives at your door on time — or we make it right.',
    bg: 'bg-blue-300',
    delay: 0.2,
  },
  {
    icon: BadgePercent,
    title: 'Zero Hidden Charges',
    description: 'You pay: food price + delivery fee + government tax. That\'s it. No platform fee, no surge pricing, no packaging fee. What you see is what you pay.',
    bg: 'bg-purple-300',
    delay: 0.25,
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
            The 2QT Difference
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.06 }}
            className="text-4xl md:text-5xl font-black font-serif tracking-tight text-brand-dark"
          >
            We cook it. We deliver it.{' '}
            <span className="text-brand-primary">We own every bite.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            className="mt-4 text-base text-zinc-600 font-medium max-w-2xl mx-auto"
          >
            Most delivery apps are middlemen. We're not. One kitchen, one team, full accountability.
          </motion.p>
        </div>

        {/* First row: 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          {CARDS.slice(0, 3).map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: card.delay, ease: [0.16, 1, 0.3, 1] }}
              className={`relative group ${card.bg} p-7 border-4 border-brand-dark transition-all duration-300 hover:-translate-y-2 hover:translate-x-2 shadow-[8px_8px_0px_#1A1A1A] overflow-hidden`}
            >
              <div className="w-14 h-14 border-2 border-brand-dark bg-white flex items-center justify-center mb-5 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_#1A1A1A]">
                <card.icon className="w-7 h-7 text-brand-dark" />
              </div>
              <h3 className="text-xl font-black font-serif text-brand-dark mb-2.5 tracking-tight uppercase">{card.title}</h3>
              <p className="text-sm text-brand-dark/80 font-semibold leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Second row: 2 cards centered */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {CARDS.slice(3).map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: card.delay, ease: [0.16, 1, 0.3, 1] }}
              className={`relative group ${card.bg} p-7 border-4 border-brand-dark transition-all duration-300 hover:-translate-y-2 hover:translate-x-2 shadow-[8px_8px_0px_#1A1A1A] overflow-hidden`}
            >
              <div className="w-14 h-14 border-2 border-brand-dark bg-white flex items-center justify-center mb-5 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_#1A1A1A]">
                <card.icon className="w-7 h-7 text-brand-dark" />
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
