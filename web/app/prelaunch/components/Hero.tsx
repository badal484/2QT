import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden bg-[#FFFBF7]">
      {/* Subtle warm gradient blob */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,87,34,0.08) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(244,211,94,0.12) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

      <div className="max-w-5xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Left: Content */}
          <div>
            {/* Location badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 border"
              style={{ background: '#FFF3E0', borderColor: '#FFCCBC', color: '#E64A19' }}
            >
              <MapPin className="w-3.5 h-3.5" />
              Launching in Lalpur, Ranchi · August 2026
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black font-serif text-[#1C1C1E] tracking-tight leading-[1.08] mb-5"
            >
              Fresh food.<br />
              <span style={{ color: '#FF5722' }}>Fair price.</span><br />
              No surprises.
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="text-base sm:text-lg text-[#6B7280] leading-relaxed mb-8 max-w-md"
            >
              2QT runs its own kitchen in Lalpur with experienced chefs.
              You pay food price + delivery + GST — nothing else.
              Quality, hygiene, and timing fully under our control.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <button
                onClick={onStart}
                className="group flex items-center justify-center gap-2 text-white font-bold text-base px-7 py-4 rounded-2xl transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #FF5722, #E64A19)', boxShadow: '0 8px 24px rgba(255,87,34,0.35)' }}
              >
                <Sparkles className="w-4 h-4" />
                Claim ₹100 Early Reward
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('why-us')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center justify-center gap-1.5 font-semibold text-sm px-6 py-4 rounded-2xl border-2 border-[#E5E7EB] text-[#374151] hover:border-[#FF5722] hover:text-[#FF5722] transition-all"
              >
                See why we're different
              </button>
            </motion.div>

            {/* Trust */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="mt-5 text-xs text-[#9CA3AF] font-medium"
            >
              No spam. First 1,000 registrations get ₹100 free wallet credit on launch day.
            </motion.p>
          </div>

          {/* Right: Visual card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="hidden md:block"
          >
            <div className="relative">
              {/* Main order card */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-orange-50">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-sm font-bold text-[#1C1C1E]">Your Order</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#FFF3E0', color: '#E64A19' }}>Cooking 🍳</span>
                </div>

                {/* Items */}
                {[
                  { name: 'Dal Makhani + Rice', price: '₹120' },
                  { name: 'Paneer Butter Masala', price: '₹150' },
                  { name: 'Tandoori Roti ×3', price: '₹45' },
                ].map(item => (
                  <div key={item.name} className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0">
                    <span className="text-sm text-[#374151]">{item.name}</span>
                    <span className="text-sm font-semibold text-[#1C1C1E]">{item.price}</span>
                  </div>
                ))}

                {/* Bill breakdown */}
                <div className="mt-4 pt-4 border-t-2 border-dashed border-[#F3F4F6] space-y-2">
                  <div className="flex justify-between text-sm text-[#6B7280]">
                    <span>Food total</span><span>₹315</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#6B7280]">
                    <span>Delivery fee</span><span>₹25</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#6B7280]">
                    <span>GST (5%)</span><span>₹17</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: '#E64A19' }}>
                    <span>Platform fee</span><span>₹0</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-[#1C1C1E] pt-1 border-t border-[#F3F4F6]">
                    <span>Total</span><span>₹357</span>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-4 -left-6 bg-white rounded-2xl px-4 py-3 shadow-lg border border-orange-100 text-sm font-semibold text-[#1C1C1E]"
              >
                🧑‍🍳 Experienced chefs
              </motion.div>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -bottom-4 -right-6 bg-white rounded-2xl px-4 py-3 shadow-lg border border-orange-100 text-sm font-semibold text-[#1C1C1E]"
              >
                ✅ ₹0 platform fee
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-14 grid grid-cols-3 gap-4 max-w-lg"
        >
          {[
            { value: '₹0', label: 'Platform fee' },
            { value: '100%', label: 'Own kitchen' },
            { value: '₹100', label: 'Launch reward' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-black font-serif" style={{ color: '#FF5722' }}>{stat.value}</p>
              <p className="text-xs text-[#9CA3AF] font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
