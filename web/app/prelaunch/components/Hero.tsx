export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-28 grid lg:grid-cols-2 gap-14 items-center">
      <div className="fade-in">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-xs font-semibold text-orange-300 badge-ring mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 pulse-dot"></span>
          Launching on campuses · August 2026
        </div>

        <h1 className="font-display text-5xl sm:text-6xl lg:text-[4rem] leading-[1.05] font-bold tracking-tight">
          Campus food,
          <span className="text-gradient block">delivered too quick.</span>
        </h1>

        <p className="mt-6 text-lg text-white/60 max-w-lg leading-relaxed">
          2QT is the delivery app built <em className="text-white/85">by</em> and <em className="text-white/85">for</em> college students — zero platform fees, hygiene-checked meals, and drops that beat your walk to the dining hall.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 max-w-md">
          <button onClick={onStart} className="btn-glow flex-1 px-6 py-4 rounded-full font-semibold text-sm whitespace-nowrap text-center">
            Get early access
          </button>
        </div>
        <p className="mt-3 text-xs text-white/35">No spam. Just a launch invite and campus perks.</p>

        <div className="mt-10 flex items-center gap-4">
          <div className="flex -space-x-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-orange-600 border-2 border-[#07070a] flex items-center justify-center text-xs font-bold text-white">JM</div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 border-2 border-[#07070a] flex items-center justify-center text-xs font-bold text-white">RA</div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 border-2 border-[#07070a] flex items-center justify-center text-xs font-bold text-white">SK</div>
            <div className="w-9 h-9 rounded-full bg-white/10 border-2 border-[#07070a] flex items-center justify-center text-[10px] font-bold text-white/70">+3k</div>
          </div>
          <p className="text-sm text-white/50"><span className="text-white font-semibold">3,482 students</span> already on the list</p>
        </div>
      </div>

      {/* Visual mockup */}
      <div className="relative fade-in" style={{ animationDelay: '.2s' }}>
        <div className="relative mx-auto w-[300px] sm:w-[330px]">
          {/* floating chips */}
          <div className="absolute -left-10 top-6 z-20 float glass rounded-2xl px-4 py-3 shadow-2xl w-40 hidden sm:block">
            <p className="text-[11px] text-white/45">Order status</p>
            <p className="text-sm font-semibold mt-0.5 flex items-center gap-1.5">🔥 Arriving in <span className="text-orange-300">6 min</span></p>
          </div>

          <div className="absolute -right-14 top-1/3 z-20 float-slow float-delay glass rounded-2xl px-4 py-3 shadow-2xl w-44 hidden sm:block">
            <p className="text-[11px] text-white/45">Split the bill</p>
            <p className="text-sm font-semibold mt-0.5">4 roommates · $3.25 ea</p>
          </div>

          <div className="absolute -left-8 bottom-8 z-20 float-slow float-delay2 glass rounded-2xl px-4 py-3 shadow-2xl w-40 hidden sm:block">
            <p className="text-sm font-semibold flex items-center gap-1.5">✅ Platform fee</p>
            <p className="text-[11px] text-orange-300 font-bold">$0.00 forever</p>
          </div>

          {/* phone frame */}
          <div className="relative rounded-[2.4rem] p-2 glass shadow-[0_40px_90px_-30px_rgba(255,90,20,0.35)]">
            <div className="rounded-[2rem] bg-[#0c0c10] overflow-hidden border border-white/5">
              <div className="flex justify-between items-center px-6 pt-4 text-[11px] text-white/40">
                <span>9:41</span>
                <span>●●●●</span>
              </div>
              <div className="px-5 pt-5 pb-8">
                <p className="text-xs text-white/40">Good evening,</p>
                <p className="font-display font-bold text-lg">Alex 👋</p>

                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 flex items-center gap-2 text-white/40 text-xs">
                  <span>🔎</span> Search dining halls, cafés...
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 to-transparent border border-orange-400/20 p-3.5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-500/20 flex items-center justify-center text-xl">🌯</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">The Burrito Bar</p>
                      <p className="text-[11px] text-white/40">0.3 mi · 8 min</p>
                    </div>
                    <p className="text-[11px] font-bold text-orange-300">$0 fee</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl">🍜</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Noodle House</p>
                      <p className="text-[11px] text-white/40">0.5 mi · 11 min</p>
                    </div>
                    <p className="text-[11px] font-bold text-orange-300">$0 fee</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl">☕</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Common Grounds</p>
                      <p className="text-[11px] text-white/40">0.2 mi · 5 min</p>
                    </div>
                    <p className="text-[11px] font-bold text-orange-300">$0 fee</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 mb-4 flex justify-center">
                <div className="w-28 h-1 rounded-full bg-white/15"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
