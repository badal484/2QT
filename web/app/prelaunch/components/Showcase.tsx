export function Showcase() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24 text-zinc-100">
      <div className="max-w-xl mx-auto text-center mb-14">
        <p className="text-xs font-bold tracking-[0.25em] text-brand-primary uppercase mb-3 drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]">Why 2QT Will Be Different</p>
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight drop-shadow-md">Good Food. Honest Prices. Happy You.</h2>
        <p className="mt-4 text-zinc-400 font-medium text-lg">We control the kitchen. We control the quality. You get the best food in Lalpur.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

        {/* Our Own Kitchen */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🍳</div>
          <h3 className="font-display text-lg font-bold mb-2">Our Own Kitchen</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Better control, better quality. Lightning-fast delivery strictly within a 4km radius of Lalpur.</p>
        </div>

        {/* Quality & Taste */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">✨</div>
          <h3 className="font-display text-lg font-bold mb-2">Quality & Taste</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">We guarantee two things on every single order: <strong className="text-white">1. Uncompromising Quality</strong> and <strong className="text-white">2. Incredible Taste</strong>.</p>
        </div>

        {/* Experienced Chefs */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">👨‍🍳</div>
          <h3 className="font-display text-lg font-bold mb-2">Experienced Chefs</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Great taste. Every time. Crafted with passion and served with pride by culinary experts.</p>
        </div>

        {/* Transparent Kitchen */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500 flex flex-col justify-between">
          <div>
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🧼</div>
            <h3 className="font-display text-lg font-bold mb-2">Hygiene First</h3>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium mb-4">Clean kitchens. Safe food. We're 100% transparent—watch our chefs maintain strict hygiene live on social media.</p>
          </div>
          <a href="https://www.instagram.com/2qtindia?utm_source=qr&igsh=bmZjMXk5NWM3a2li" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand-primary text-sm font-semibold hover:text-white transition-colors mt-auto">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Follow @2qtindia
          </a>
        </div>
      </div>
    </section>
  );
}
