'use client';
import { Hero } from './Hero';
import { WhyUs } from './WhyUs';
import { Pricing } from './Pricing';
import { Story } from './Story';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full min-h-screen bg-[#FFFBF7]" style={{ scrollBehavior: 'smooth' }}>

      {/* Sticky navbar */}
      <header className="sticky top-0 z-50 bg-[#FFFBF7]/90 backdrop-blur-md border-b border-[#F3F4F6]">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm"
              style={{ background: '#FF5722' }}
            >
              2Q
            </div>
            <span className="font-black text-lg text-[#1C1C1E] tracking-tight">2QT</span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6B7280]">
            <button
              onClick={() => document.getElementById('why-us')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-[#1C1C1E] transition-colors"
            >
              Why 2QT
            </button>
            <button
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-[#1C1C1E] transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => document.getElementById('countdown')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-[#1C1C1E] transition-colors"
            >
              Launch Date
            </button>
          </nav>

          <button
            onClick={onStart}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors active:scale-95"
            style={{ background: '#FF5722' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E64A19')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FF5722')}
          >
            Get Early Access
          </button>
        </div>
      </header>

      <Hero onStart={onStart} />
      <div id="why-us"><WhyUs /></div>
      <div id="pricing"><Pricing /></div>
      <Story />
      <div id="countdown"><Countdown onStart={onStart} /></div>

      {/* Footer */}
      <footer className="border-t border-[#F3F4F6] py-10 px-5" style={{ background: '#111111' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: '#FF5722' }}
            >
              2Q
            </div>
            <span className="font-bold text-white">2QT</span>
            <span className="text-[#6B7280] text-sm ml-2">— Fresh food, fair price.</span>
          </div>
          <p className="text-[#6B7280] text-sm">2026 2QT · Lalpur, Ranchi, Jharkhand</p>
        </div>
      </footer>

      <LiveCounter />
    </div>
  );
}
