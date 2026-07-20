import { motion } from 'framer-motion';
import { ChefHat, HandPlatter, Leaf, ShoppingBag } from 'lucide-react';

const PILLARS = [
  {
    icon: HandPlatter,
    heading: "We serve. We're accountable.",
    body: "Unlike platforms that connect you to random cloud kitchens, 2QT operates from our own kitchen. When something is wrong, we fix it — because there's no third party to point fingers at.",
  },
  {
    icon: ChefHat,
    heading: 'Chefs who take pride in their work.',
    body: 'Our kitchen is staffed by experienced, full-time chefs — not gig workers rotating daily. Same hands, same recipes, same quality every single time you order.',
  },
  {
    icon: Leaf,
    heading: 'Fresh ingredients. Every order.',
    body: 'We start cooking after you tap Order. No pre-cooked batches kept in warmers. No shortcuts. Your food is made to order, the way restaurant food should be.',
  },
  {
    icon: ShoppingBag,
    heading: 'What you see is what you pay.',
    body: 'The bill is simple: food price + delivery fee + GST. No platform fee. No convenience fee. No surge. No packaging charge. Transparent pricing is a promise, not a promotion.',
  },
];

export function About() {
  return (
    <section className="py-24 bg-brand-dark relative overflow-hidden border-t-4 border-brand-dark">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-brand-accent/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">

        {/* Header */}
        <div className="mb-16">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold text-brand-accent uppercase tracking-[0.18em] mb-4"
          >
            Who we are
          </motion.p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black font-serif text-white tracking-tighter leading-[1.05] max-w-2xl"
            >
              2QT is not an app.{' '}
              <span className="text-brand-primary">It's a kitchen.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-zinc-400 font-medium text-base max-w-sm leading-relaxed"
            >
              Most delivery apps are marketplaces. We're a restaurant that delivers.
              The difference matters more than you think.
            </motion.p>
          </div>
        </div>

        {/* Story block */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border-2 border-white/10 p-8 md:p-10 mb-14"
        >
          <p className="text-white/90 text-lg md:text-xl font-medium leading-relaxed max-w-3xl">
            We noticed something broken about food delivery in Ranchi — hidden fees,
            inconsistent quality, and zero accountability. So we built the opposite.
            <span className="text-brand-accent font-bold"> 2QT operates from its own kitchen in Lalpur, Ranchi</span> —
            with experienced chefs, tight hygiene standards, and a pricing policy so
            simple it fits in one line: <span className="text-brand-primary font-bold">food price + delivery + tax.</span>
            {' '}Nothing else.
          </p>
        </motion.div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.heading}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group flex gap-5 p-7 border-2 border-white/10 hover:border-brand-primary/50 hover:bg-white/5 transition-all duration-300"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
                <p.icon className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-white font-black font-serif text-lg mb-2 tracking-tight">{p.heading}</h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom tagline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-14 pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <p className="text-2xl md:text-3xl font-black font-serif text-white tracking-tight text-center md:text-left">
            Launching in <span className="text-brand-accent">Lalpur, Ranchi</span> — August 2026.
          </p>
          <div className="flex flex-col gap-1 text-sm font-semibold text-zinc-400 text-center md:text-right">
            <span className="text-white font-bold">First 1,000 registrations</span>
            <span>get a free meal on launch day.</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
