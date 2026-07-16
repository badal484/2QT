'use client';
import { motion } from 'framer-motion';
import { ChefHat, IndianRupee, MapPin, ShieldCheck, UtensilsCrossed } from 'lucide-react';

const PILLARS = [
  {
    Icon: UtensilsCrossed,
    heading: 'One kitchen',
    body: 'Our own kitchen in Lalpur, Ranchi. Not a marketplace of unknown vendors — one address, full accountability.',
    color: '#FF5722',
    bg: '#FFF3E0',
  },
  {
    Icon: ChefHat,
    heading: 'Full-time chefs',
    body: 'Professional chefs on payroll, not rotating gig workers. Consistent taste and quality, every single order.',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
  {
    Icon: ShieldCheck,
    heading: 'Our hygiene standard',
    body: 'We set the standard and we enforce it. Daily sanitisation, fresh-sourced ingredients, FSSAI compliant.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    Icon: IndianRupee,
    heading: 'What you pay for',
    body: 'Food price. Delivery. GST. That is the full list. No platform fees, no convenience fees, no packaging surcharges.',
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
];

export function Story() {
  return (
    <section className="py-24 bg-[#FFFBF7]">
      <div className="max-w-5xl mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* Left: Story */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-3 text-xs font-bold uppercase tracking-widest"
              style={{ color: '#FF5722' }}
            >
              Our Story
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.07 }}
              className="text-3xl sm:text-4xl font-black font-serif tracking-tight text-[#1C1C1E] mb-6"
            >
              2QT is not an app.<br />
              <span style={{ color: '#FF5722' }}>It&apos;s a kitchen.</span>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.12 }}
              className="space-y-4 text-[#4B5563] leading-relaxed text-base"
            >
              <p>
                We looked at food delivery in Ranchi and saw the same problem everywhere —
                hidden fees, inconsistent quality, and zero accountability. When something
                goes wrong, everyone points at someone else.
              </p>
              <p>
                So we built the opposite.{' '}
                <span className="font-semibold text-[#1C1C1E]">
                  2QT operates from its own kitchen in Lalpur
                </span>{' '}
                with experienced, full-time chefs. We source the ingredients, cook the food,
                and deliver it ourselves.
              </p>
              <p>
                When you order from 2QT, there&apos;s no middleman.{' '}
                <span className="font-semibold text-[#1C1C1E]">
                  If something is wrong, we are responsible
                </span>{' '}
                — and that&apos;s exactly how we designed it.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="mt-7 inline-flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-sm font-semibold"
              style={{ background: '#FFF3E0', borderColor: '#FFCCBC', color: '#E64A19' }}
            >
              <MapPin className="h-4 w-4 flex-shrink-0" />
              Starting in Lalpur, Ranchi — August 2026
            </motion.div>
          </div>

          {/* Right: Pillars */}
          <div className="space-y-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.heading}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                whileHover={{ x: 4 }}
                className="flex gap-4 p-5 rounded-2xl bg-white border border-[#F3F4F6] hover:border-orange-200 hover:shadow-md transition-all"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: p.bg }}
                >
                  <p.Icon className="w-5 h-5" style={{ color: p.color }} />
                </div>
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
