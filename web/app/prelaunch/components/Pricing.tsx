'use client';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export function Pricing() {
  return (
    <section className="py-24" style={{ background: '#111111' }}>
      <div className="max-w-5xl mx-auto px-5">

        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: '#FF8A65' }}
          >
            Transparent Pricing
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.07 }}
            className="text-3xl sm:text-4xl font-black font-serif text-white tracking-tight"
          >
            What you see is what you pay.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.12 }}
            className="mt-3 text-[#9CA3AF] text-base"
          >
            No checkout surprises. No fine print.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">

          {/* 2QT bill */}
          <motion.div
            initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55 }}
            className="rounded-3xl p-7 border-2"
            style={{ background: '#1A1A1A', borderColor: '#FF5722' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-xl bg-[#FF5722] flex items-center justify-center font-black text-white text-xs">2Q</div>
              <span className="font-bold text-white text-base">2QT Bill</span>
              <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-bold bg-[#FF5722]/20 text-[#FF8A65]">
                Fair price
              </span>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Food price', value: '₹315', highlight: false },
                { label: 'Delivery fee', value: '₹25', highlight: false },
                { label: 'GST (5%)', value: '₹17', highlight: false },
                { label: 'Platform fee', value: '₹0', highlight: true },
                { label: 'Surge pricing', value: '₹0', highlight: true },
                { label: 'Packaging fee', value: '₹0', highlight: true },
              ].map(row => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${row.highlight ? 'bg-[#FF5722]/10' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className={`text-sm ${row.highlight ? 'text-[#FF8A65] font-semibold' : 'text-[#D1D5DB]'}`}>
                      {row.label}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${row.highlight ? 'text-emerald-400' : 'text-white'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-white font-bold">Total</span>
              <span className="text-2xl font-black text-white">₹357</span>
            </div>
          </motion.div>

          {/* Others bill */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55 }}
            className="rounded-3xl p-7 border border-[#2A2A2A]"
            style={{ background: '#1A1A1A' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-xl bg-[#2A2A2A] flex items-center justify-center text-[#9CA3AF] font-bold text-xs">
                Other
              </div>
              <span className="font-bold text-[#9CA3AF] text-base">Other Apps</span>
              <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-bold bg-red-500/10 text-red-400">
                Expensive
              </span>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Food price', value: '₹315', bad: false },
                { label: 'Delivery fee', value: '₹49', bad: false },
                { label: 'GST', value: '₹21', bad: false },
                { label: 'Platform fee', value: '₹25', bad: true },
                { label: 'Surge pricing', value: '₹30', bad: true },
                { label: 'Packaging fee', value: '₹15', bad: true },
              ].map(row => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${row.bad ? 'bg-red-500/5' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    {row.bad
                      ? <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                      : <Check className="w-4 h-4 text-[#6B7280] flex-shrink-0" />}
                    <span className={`text-sm ${row.bad ? 'text-red-400 font-semibold' : 'text-[#9CA3AF]'}`}>
                      {row.label}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${row.bad ? 'text-red-400' : 'text-[#D1D5DB]'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-[#9CA3AF] font-bold">Total</span>
              <div className="text-right">
                <span className="text-2xl font-black text-white">₹455</span>
                <p className="text-xs text-red-400 font-medium mt-0.5">₹98 more than 2QT</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ delay: 0.3 }}
          className="text-center mt-8 text-[#6B7280] text-xs"
        >
          Comparison based on typical order on popular Indian food delivery apps. 2QT pricing is always food + delivery + GST only.
        </motion.p>
      </div>
    </section>
  );
}
