'use client';
import { motion } from 'framer-motion';
import { ChefHat, Clock, IndianRupee, ShieldCheck, UtensilsCrossed } from 'lucide-react';

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 80 } },
};

export function WhyUs() {
  return (
    <section id="why-us" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-5">

        {/* Header */}
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: '#FF5722' }}
          >
            The 2QT Difference
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.07 }}
            className="text-3xl sm:text-4xl font-black font-serif tracking-tight text-[#1C1C1E]"
          >
            We cook it. We deliver it.<br />
            <span style={{ color: '#FF5722' }}>We own every bite.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.12 }}
            className="mt-3 max-w-xl mx-auto text-base text-[#6B7280]"
          >
            Most delivery apps are middlemen. 2QT is a restaurant that delivers —
            students are our focus, everyone in Lalpur is welcome.
          </motion.p>
        </div>

        {/* Bento grid */}
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}
          transition={{ staggerChildren: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* Large hero card - Own Kitchen */}
          <motion.div
            variants={item}
            whileHover={{ y: -4, boxShadow: '0 20px 50px rgba(255,87,34,0.15)' }}
            className="sm:col-span-2 rounded-3xl p-8 flex flex-col justify-between min-h-[240px] cursor-default transition-shadow"
            style={{ background: 'linear-gradient(135deg,#FF5722 0%,#E64A19 100%)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Our Own Kitchen</h3>
              <p className="text-white/80 text-sm leading-relaxed max-w-sm">
                We operate from our own kitchen in Lalpur — not a marketplace. Every dish comes
                from one address, under our full control.
              </p>
            </div>
          </motion.div>

          {/* Chefs card */}
          <motion.div
            variants={item}
            whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.08)' }}
            className="rounded-3xl p-7 bg-[#FAFAFA] border border-[#F3F4F6] flex flex-col justify-between min-h-[240px] cursor-default transition-shadow"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1C1C1E] mb-1.5">Experienced Chefs</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                Full-time professional chefs. Same team, same recipes, consistent quality — every order.
              </p>
            </div>
          </motion.div>

          {/* Hygiene */}
          <motion.div
            variants={item}
            whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.08)' }}
            className="rounded-3xl p-7 bg-[#FAFAFA] border border-[#F3F4F6] flex flex-col justify-between min-h-[200px] cursor-default transition-shadow"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1C1C1E] mb-1.5">Hygiene Guaranteed</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                We set our own hygiene standards and enforce them. Daily sanitisation, FSSAI compliant.
              </p>
            </div>
          </motion.div>

          {/* On-Time */}
          <motion.div
            variants={item}
            whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.08)' }}
            className="rounded-3xl p-7 bg-[#FAFAFA] border border-[#F3F4F6] flex flex-col justify-between min-h-[200px] cursor-default transition-shadow"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1C1C1E] mb-1.5">On-Time Delivery</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                We own the kitchen and the delivery. No third-party delays. Food arrives hot, on time.
              </p>
            </div>
          </motion.div>

          {/* Zero fees - accent card */}
          <motion.div
            variants={item}
            whileHover={{ y: -4, boxShadow: '0 20px 50px rgba(255,87,34,0.12)' }}
            className="rounded-3xl p-7 border border-orange-200 flex flex-col justify-between min-h-[200px] cursor-default transition-shadow"
            style={{ background: '#FFF3E0' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center">
              <IndianRupee className="w-6 h-6" style={{ color: '#FF5722' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1C1C1E] mb-1.5">Zero Hidden Charges</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#92400E' }}>
                Food + delivery + GST. No platform fee, no surge, no packaging charge. Ever.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
