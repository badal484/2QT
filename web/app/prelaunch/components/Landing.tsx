'use client';
import { Hero } from './Hero';
import { Showcase } from './Showcase';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';
import { VerticalSidebar } from './VerticalSidebar';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full min-h-screen bg-transparent" style={{ scrollBehavior: 'smooth' }}>
      <VerticalSidebar />

      {/* Floating navbar */}
      <div className="fixed top-4 sm:top-6 left-0 right-0 z-50 px-3 sm:px-4 flex justify-center">
        <header className="w-full max-w-6xl bg-white/5 backdrop-blur-2xl shadow-2xl border border-white/10 rounded-full px-5 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between">
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
            className="rounded-full px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] border border-brand-primary/50"
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
               <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                 <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
               </svg>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Follow our journey</p>
              <p className="text-lg text-white font-bold group-hover:text-brand-primary transition-colors">@2qtindia</p>
            </div>
          </a>

          <div className="flex items-start gap-3 px-8 py-4 rounded-full bg-white/5 border border-white/10 shadow-lg">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-brand-primary mt-0.5 shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Find us at</p>
              <p className="text-sm text-white font-semibold leading-snug">401, 3rd Floor, Devrani Complex</p>
              <p className="text-sm text-zinc-400 font-medium">Lalpur, Ranchi</p>
            </div>
          </div>

          <a href="tel:+916204646300" className="flex items-start gap-3 px-8 py-4 rounded-full bg-white/5 border border-white/10 hover:border-brand-primary/50 hover:bg-white/10 transition-all group shadow-lg">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-brand-primary mt-0.5 shrink-0 group-hover:scale-110 transition-transform">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Call us</p>
              <p className="text-sm text-white font-semibold group-hover:text-brand-primary transition-colors">+91 62046 46300</p>
            </div>
          </a>

          <p className="text-sm text-zinc-500 mt-4 font-medium">© 2026 2QT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
