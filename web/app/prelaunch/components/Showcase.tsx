export function Showcase() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24 text-zinc-100">
      <div className="max-w-xl mx-auto text-center mb-14">
        <p className="text-xs font-bold tracking-[0.25em] text-brand-primary uppercase mb-3 drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]">Why 2QT Will Be Different</p>
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight drop-shadow-md">Good Food. Honest Prices. Happy You.</h2>
        <p className="mt-4 text-zinc-400 font-medium text-lg">We control the kitchen. We control the quality. You get the best food in Lalpur.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-5">
        {/* Big card */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-8 sm:col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="absolute -top-10 -right-10 w-52 h-52 bg-brand-primary/20 rounded-full blur-[80px] group-hover:bg-brand-primary/30 transition-colors duration-500"></div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl mb-6 shadow-inner">💸</div>
              <h3 className="font-display text-2xl font-bold mb-3 drop-shadow-sm">No platform charge. Ever.</h3>
              <p className="text-zinc-400 leading-relaxed font-medium">No hidden fees. No commissions. You pay only for delivery & GST. Honest pricing for students.</p>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm">
              <span className="line-through text-zinc-600">₹49 fees</span>
              <span className="font-display font-bold text-brand-primary text-lg drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]">₹0</span>
              <span className="text-xs px-3 py-1.5 rounded-full bg-brand-primary/20 text-brand-primary font-semibold border border-brand-primary/30">Always</span>
            </div>
          </div>
        </div>

        {/* Campus-fast */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 sm:col-span-2 lg:col-span-2 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🍳</div>
              <h3 className="font-display text-xl font-bold mb-2">Our Own Kitchen</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-medium max-w-xs">Better control, better quality. Combined with lightning-fast delivery strictly within a 4km radius of Lalpur.</p>
            </div>
          </div>
        </div>

        {/* Quality and Taste */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">👨‍🍳</div>
          <h3 className="font-display text-lg font-bold mb-2">Experienced Chefs</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Great taste. Every time. Crafted with passion and served with pride by culinary experts.</p>
        </div>

        {/* Transparent Kitchen */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🧼</div>
          <h3 className="font-display text-lg font-bold mb-2">Hygiene First</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Clean kitchens. Safe food. We're 100% transparent—watch our chefs maintain strict hygiene live on social media.</p>
        </div>
      </div>
    </section>
  );
}
