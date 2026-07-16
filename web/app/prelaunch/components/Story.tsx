import { motion } from 'framer-motion';

const PILLARS = [
  { emoji: '🍳', heading: 'One kitchen', body: 'Our own kitchen in Lalpur, Ranchi. Not a marketplace of unknown vendors — one address, full accountability.' },
  { emoji: '👨‍🍳', heading: 'Full-time chefs', body: 'Professional chefs on payroll, not rotating gig workers. Consistent taste and quality, every single order.' },
  { emoji: '🧼', heading: 'Our hygiene standard', body: 'We set the standard and we enforce it. Daily sanitisation, fresh-sourced ingredients, FSSAI compliant — because it\'s our kitchen.' },
  { emoji: '📦', heading: 'What you pay for', body: 'Food price. Delivery. GST. That\'s the full list. We don\'t add platform fees, convenience fees, or packaging surcharges.' },
];

export function Story() {
  return (
    <section className="py-20 bg-[#FFFBF7]">
      <div className="max-w-5xl mx-auto px-5">

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* Left: Story */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: '#FF5722' }}
            >
              Our Story
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.07 }}
              className="text-3xl sm:text-4xl font-black font-serif text-[#1C1C1E] tracking-tight mb-6"
            >
              2QT is not an app.<br />
              <span style={{ color: '#FF5722' }}>It's a kitchen.</span>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12 }}
              className="space-y-4 text-[#4B5563] leading-relaxed text-base"
            >
              <p>
                We looked at food delivery in Ranchi and saw the same problem everywhere —
                hidden fees, inconsistent quality, and zero accountability. When something
                goes wrong, everyone points at someone else.
              </p>
              <p>
                So we built the opposite. <span className="font-semibold text-[#1C1C1E]">2QT operates from its own kitchen
                in Lalpur</span> with experienced, full-time chefs. We source the ingredients,
                cook the food, and deliver it ourselves.
              </p>
              <p>
                When you order from 2QT, there's no middleman. <span className="font-semibold text-[#1C1C1E]">
                If something is wrong, we're responsible</span> — and that's exactly how we designed it.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="mt-7 inline-flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-semibold"
              style={{ background: '#FFF3E0', borderColor: '#FFCCBC', color: '#E64A19' }}
            >
              <span className="text-lg">📍</span>
              Starting in Lalpur, Ranchi — August 2026
            </motion.div>
          </div>

          {/* Right: Pillars */}
          <div className="space-y-4">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.heading}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="flex gap-4 p-5 rounded-2xl bg-white border border-[#F3F4F6] hover:border-orange-200 hover:shadow-sm transition-all"
              >
                <div className="text-2xl flex-shrink-0 mt-0.5">{p.emoji}</div>
                <div>
                  <h3 className="font-bold text-[#1C1C1E] text-base mb-1">{p.heading}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
