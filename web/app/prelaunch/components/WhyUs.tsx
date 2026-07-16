import { motion } from 'framer-motion';
import { ChefHat, Clock, IndianRupee, ShieldCheck, UtensilsCrossed } from 'lucide-react';

const FEATURES = [
  {
    icon: UtensilsCrossed,
    title: 'Our Own Kitchen',
    desc: 'We operate from our own kitchen in Lalpur — not a marketplace of random cloud kitchens. Every dish comes from one place, under our full control.',
    color: '#FF5722',
    bg: '#FFF3E0',
  },
  {
    icon: ChefHat,
    title: 'Experienced Chefs',
    desc: 'Our full-time professional chefs cook every order. Same team, same recipes, same quality — order after order, day after day.',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
  {
    icon: ShieldCheck,
    title: 'Hygiene You Can Trust',
    desc: 'Because we run the kitchen ourselves, hygiene is non-negotiable. Daily sanitisation, fresh ingredients, and FSSAI-compliant practices — always.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    icon: Clock,
    title: 'On-Time Delivery',
    desc: 'We own the kitchen and the delivery. No third-party delays. Your food leaves hot and arrives on time — or we make it right.',
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    icon: IndianRupee,
    title: 'Zero Hidden Charges',
    desc: 'The bill is simple: food price + delivery fee + GST. No platform fee. No surge. No packaging charge. No convenience fee. Ever.',
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
];

export function WhyUs() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-5">

        {/* Header */}
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: '#FF5722' }}
          >
            The 2QT Difference
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.07 }}
            className="text-3xl sm:text-4xl font-black font-serif text-[#1C1C1E] tracking-tight"
          >
            We cook it. We deliver it.<br />
            <span style={{ color: '#FF5722' }}>We own every bite.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            className="mt-3 text-[#6B7280] text-base max-w-xl mx-auto"
          >
            Most delivery apps are middlemen. 2QT is a restaurant that delivers —
            students are our focus, everyone in Lalpur is welcome.
          </motion.p>
        </div>

        {/* Features grid: 3 top + 2 bottom */}
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          {FEATURES.slice(0, 3).map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl p-6 border border-[#F3F4F6] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow"
              style={{ background: '#FAFAFA' }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: f.bg }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="font-bold text-[#1C1C1E] text-base mb-2">{f.title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {FEATURES.slice(3).map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl p-6 border border-[#F3F4F6] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow"
              style={{ background: '#FAFAFA' }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: f.bg }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="font-bold text-[#1C1C1E] text-base mb-2">{f.title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
