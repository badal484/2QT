'use client';
import { Hero } from './Hero';
import { Showcase } from './Showcase';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';
import { FloatingQualityBadge } from './FloatingQualityBadge';

import { Instagram } from 'lucide-react';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full min-h-screen bg-transparent" style={{ scrollBehavior: 'smooth' }}>
      <FloatingQualityBadge />

      {/* Floating navbar */}
      <div className="fixed top-6 left-0 right-0 z-50 px-4 flex justify-center">
        <header className="w-full max-w-6xl bg-white/5 backdrop-blur-2xl shadow-2xl border border-white/10 rounded-full px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-display font-black text-2xl tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">2QT<span className="text-brand-primary drop-shadow-[0_0_15px_rgba(255,90,31,0.8)]">.</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-400">
            <button onClick={() => document.getElementById('vision')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">The Vision</button>
            <button onClick={() => document.getElementById('rewards')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Rewards</button>
            <button onClick={onStart} className="hover:text-brand-primary transition-colors text-brand-primary drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]">Check Status</button>
          </nav>

          <button
            onClick={onStart}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] border border-brand-primary/50"
            style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}
          >
            Join Waitlist
          </button>
        </header>
      </div>

      <Hero onStart={onStart} />
      <div id="vision"><Showcase /></div>
      <div id="rewards"><Countdown onStart={onStart} /></div>
      <LiveCounter />

      {/* Footer */}
      <footer className="pt-16 pb-24 border-t border-white/10 text-center relative z-10 bg-black/20">
        <div className="flex flex-col items-center justify-center gap-6">
          <span className="font-display font-black text-3xl tracking-tight text-white opacity-80">2QT<span className="text-brand-primary">.</span></span>
          
          <a 
            href="https://www.instagram.com/2qtindia?utm_source=qr&igsh=bmZjMXk5NWM3a2li" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-4 px-8 py-4 rounded-full bg-white/5 border border-white/10 hover:border-brand-primary/50 hover:bg-white/10 transition-all group shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
               <Instagram className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Follow our journey</p>
              <p className="text-lg text-white font-bold group-hover:text-brand-primary transition-colors">@2qtindia</p>
            </div>
          </a>

          <p className="text-sm text-zinc-500 mt-4 font-medium">© 2026 2QT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
