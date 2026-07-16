'use client';
import { Hero } from './Hero';
import { Showcase } from './Showcase';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full min-h-screen bg-transparent" style={{ scrollBehavior: 'smooth' }}>

      {/* Floating navbar */}
      <div className="fixed top-6 left-0 right-0 z-50 px-4 flex justify-center">
        <header className="w-full max-w-6xl bg-white/5 backdrop-blur-2xl shadow-2xl border border-white/10 rounded-full px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-display font-black text-2xl tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">2QT<span className="text-brand-primary drop-shadow-[0_0_15px_rgba(255,90,31,0.8)]">.</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-400">
            <button className="hover:text-white transition-colors">Our Kitchens</button>
            <button className="hover:text-white transition-colors">The App</button>
            <button className="hover:text-brand-primary transition-colors text-brand-primary drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]">My Account</button>
          </nav>

          <button
            onClick={onStart}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] border border-brand-primary/50"
            style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}
          >
            Order Now
          </button>
        </header>
      </div>

      <Hero onStart={onStart} />
      <Showcase />
      <Countdown onStart={onStart} />
      <LiveCounter />
    </div>
  );
}
