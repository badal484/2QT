'use client';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

const features: { name: string; qt2: boolean | 'partial'; others: boolean | 'partial' }[] = [
  { name: 'Own Kitchen', qt2: true, others: false },
  { name: 'Quality Control', qt2: true, others: 'partial' },
  { name: 'Taste Consistency', qt2: true, others: 'partial' },
  { name: 'No Platform Fee', qt2: true, others: false },
  { name: 'Hot & Fresh Guaranteed', qt2: true, others: 'partial' },
  { name: 'Fast Delivery', qt2: true, others: 'partial' },
];

const FeatureIcon = ({ status }: { status: boolean | 'partial' }) => {
  if (status === true) {
    return <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#73A924]" fill="currentColor" stroke="black" />;
  }
  if (status === false) {
    return <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#D02C26]" fill="currentColor" stroke="black" />;
  }
  return <MinusCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#EBA900]" fill="currentColor" stroke="black" />;
};

export function Comparison() {
  return (
    <section className="relative w-full py-20 overflow-hidden flex justify-center px-4 sm:px-8 z-20">
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 50% 50%, #FF5A1F 0%, transparent 60%)' }} />
      
      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-8 items-center bg-black/40 backdrop-blur-md rounded-[2rem] border border-white/5 p-4 sm:p-8 lg:p-12 shadow-2xl">
        
        {/* Left Side: Copy */}
        <div className="flex-1 flex flex-col gap-6 w-full relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex px-4 py-1.5 bg-white/5 border border-white/10 rounded-full w-fit backdrop-blur-sm"
          >
            <span className="font-sans font-bold text-sm tracking-[0.2em] text-zinc-300 uppercase">Why 2QT is better</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-2 mt-2"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white tracking-tight uppercase leading-tight">
              Other apps assure,<br />
              <span className="text-brand-primary">We control.</span>
            </h2>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-zinc-400 font-medium leading-relaxed max-w-md mt-4"
          >
            We have our <span className="text-white font-bold">own kitchen</span>, so we have full control over <span className="text-white font-bold">quality & taste</span>.
          </motion.p>
        </div>

        {/* Right Side: Table */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="w-full lg:w-[600px] shrink-0"
        >
          <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
            {/* Table Header */}
            <div className="grid grid-cols-3 border-b border-white/10 text-center items-center">
              <div className="col-span-1 p-2.5 sm:p-4" />
              <div className="col-span-1 p-2.5 sm:p-4 bg-white/5 border-x border-brand-primary/30 relative">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-primary" />
                <span className="font-display font-black text-lg sm:text-2xl tracking-tight text-white">2QT<span className="text-brand-primary">.</span></span>
              </div>
              <div className="col-span-1 p-2.5 sm:p-4 bg-[#741515]/30">
                <span className="font-display font-bold text-sm sm:text-lg text-white opacity-90 tracking-wide uppercase">Others</span>
              </div>
            </div>

            {/* Table Body */}
            <div className="flex flex-col">
              {features.map((feature, i) => (
                <div key={i} className="grid grid-cols-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors">
                  <div className="col-span-1 p-2.5 sm:p-4 lg:p-5 flex items-center gap-3 border-r border-white/5">
                    <span className="text-xs sm:text-sm lg:text-base font-semibold text-zinc-300 leading-tight">{feature.name}</span>
                  </div>

                  <div className="col-span-1 p-2.5 sm:p-4 lg:p-5 bg-white/5 border-r border-white/5 flex items-center justify-center backdrop-blur-sm">
                    <FeatureIcon status={feature.qt2} />
                  </div>

                  <div className="col-span-1 p-2.5 sm:p-4 lg:p-5 flex items-center justify-center">
                    <FeatureIcon status={feature.others} />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Table Footer Legend */}
            <div className="bg-white/5 p-3 flex justify-center gap-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <CheckCircle2 className="w-3 h-3 text-[#73A924]" fill="currentColor" stroke="black" /> Yes
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <MinusCircle className="w-3 h-3 text-[#EBA900]" fill="currentColor" stroke="black" /> Varies
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <XCircle className="w-3 h-3 text-[#D02C26]" fill="currentColor" stroke="black" /> No
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
