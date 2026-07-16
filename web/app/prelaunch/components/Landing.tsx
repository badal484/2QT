'use client';
import { Hero } from './Hero';
import { Showcase } from './Showcase';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full min-h-screen bg-[#FAFAFA]" style={{ scrollBehavior: 'smooth' }}>

      {/* Floating navbar */}
      <div className="fixed top-6 left-0 right-0 z-50 px-4 flex justify-center">
        <header className="w-full max-w-6xl bg-white shadow-sm border border-gray-100 rounded-full px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-display font-black text-2xl tracking-tight text-zinc-900">2QT<span className="text-orange-500">.</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-500">
            <button className="hover:text-zinc-900 transition-colors">Our Kitchens</button>
            <button className="hover:text-zinc-900 transition-colors">The App</button>
            <button className="hover:text-orange-500 transition-colors text-orange-400">My Account</button>
          </nav>

          <button
            onClick={onStart}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105 shadow-[0_4px_14px_0_rgba(255,107,53,0.39)]"
            style={{ background: 'linear-gradient(to right, #ff7a45, #ff5722)' }}
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
