import { Hero } from './Hero';
import { WhyUs } from './WhyUs';
import { Pricing } from './Pricing';
import { Story } from './Story';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full min-h-screen bg-[#FFFBF7]">

      {/* Sticky navbar */}
      <header className="sticky top-0 z-50 bg-[#FFFBF7]/90 backdrop-blur-md border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF5722] flex items-center justify-center text-white font-bold text-sm">2Q</div>
            <span className="font-bold text-lg text-[#1C1C1E] tracking-tight">2QT</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6B7280]">
            <button onClick={() => document.getElementById('why-us')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[#1C1C1E] transition-colors">Why 2QT</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[#1C1C1E] transition-colors">Pricing</button>
            <button onClick={() => document.getElementById('countdown')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[#1C1C1E] transition-colors">Launch Date</button>
          </div>
          <button onClick={onStart} className="bg-[#FF5722] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#E64A19] transition-colors active:scale-95">
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
      <footer className="border-t border-orange-100 py-10 px-5 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF5722] flex items-center justify-center text-white font-bold text-xs">2Q</div>
            <span className="font-bold text-[#1C1C1E]">2QT</span>
            <span className="text-[#9CA3AF] text-sm ml-2">— Fresh food, fair price.</span>
          </div>
          <p className="text-[#9CA3AF] text-sm">© 2026 2QT · Lalpur, Ranchi, Jharkhand</p>
        </div>
      </footer>

      <LiveCounter />
    </div>
  );
}
