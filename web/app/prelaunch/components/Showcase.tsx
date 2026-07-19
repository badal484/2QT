export function Showcase() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24 text-zinc-100">
      <div className="max-w-xl mx-auto text-center mb-14">
        <p className="text-xs font-bold tracking-[0.25em] text-brand-primary uppercase mb-3 drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]">Why 2QT Will Be Different</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-md">Good Food. Honest Prices. Happy You.</h2>
        <p className="mt-4 text-zinc-400 font-medium text-lg">We control the kitchen. We control the quality. You get the best food in Lalpur.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Big card */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 sm:col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
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
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-7 sm:col-span-2 lg:col-span-2 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🍳</div>
          <h3 className="font-display text-lg font-bold mb-2">Our Own Kitchen</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Better control, better quality. Lightning-fast delivery strictly within a 4km radius of Lalpur.</p>
        </div>

        {/* Quality */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">✨</div>
          <h3 className="font-display text-lg font-bold mb-2">Quality</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Uncompromising standards on every single order.</p>
        </div>

        {/* Taste */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-7 lg:col-span-1 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🌟</div>
          <h3 className="font-display text-lg font-bold mb-2">Taste</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Incredible flavor crafted by our culinary experts.</p>
        </div>

        {/* Experienced Chefs */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-7 sm:col-span-2 lg:col-span-2 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">👨‍🍳</div>
          <h3 className="font-display text-lg font-bold mb-2">Experienced Chefs</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">Great taste. Every time. Crafted with passion and served with pride.</p>
        </div>

        {/* Hot Food Guarantee */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 sm:col-span-2 lg:col-span-4 relative overflow-hidden shadow-lg hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all border border-white/10 hover:border-red-500/40 duration-500">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-red-500/10 rounded-full blur-[100px] group-hover:bg-red-500/20 transition-colors duration-500" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 shadow-inner">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444">
                  <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-bold mb-2">Guaranteed Hot & Fresh Food</h3>
                <p className="text-zinc-400 text-sm leading-relaxed font-medium max-w-2xl">
                  Here, we assure you hot food. Every order leaves our kitchen piping hot. We deliver within our own 4km radius so your food arrives the way it was cooked — not lukewarm. If it's not hot, we make it right. No questions asked.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-sm whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/></svg>
              The 2QT Hot Promise
            </div>
          </div>
        </div>

        {/* Transparent Kitchen */}
        <div className="group bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-7 sm:col-span-2 lg:col-span-2 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,90,31,0.15)] transition-all border border-white/10 hover:border-brand-primary/40 duration-500 flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex-1">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl mb-5 shadow-inner">🧼</div>
            <h3 className="font-display text-lg font-bold mb-2">Hygiene First</h3>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">Clean kitchens. Safe food. We're 100% transparent—watch our chefs maintain strict hygiene live on social media.</p>
          </div>
          <div className="flex items-end shrink-0">
            <a href="https://www.instagram.com/2qtindia?utm_source=qr&igsh=bmZjMXk5NWM3a2li" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-brand-primary hover:text-white transition-all text-sm font-semibold shadow-md">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Follow @2qtindia
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
