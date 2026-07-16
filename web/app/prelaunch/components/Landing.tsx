import { Hero } from './Hero';
import { Showcase } from './Showcase';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative w-full text-white overflow-hidden">
      {/* ===== Navbar ===== */}
      <header className="relative z-30 max-w-7xl mx-auto px-6 lg:px-10 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-display font-bold text-sm badge-ring">2Q</div>
          <span className="font-display font-bold text-lg tracking-tight">2QT</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Features</button>
          <button onClick={() => document.getElementById('countdown')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Launch</button>
          <button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">FAQ</button>
        </nav>
        <button onClick={onStart} className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full glass hover:border-orange-400/60 transition-colors">
          Join waitlist
          <span className="text-orange-400">→</span>
        </button>
      </header>

      <Hero onStart={onStart} />

      <div id="features">
        <Showcase />
      </div>

      <div id="countdown">
        <Countdown onStart={onStart} />
      </div>

      {/* ===== FAQ ===== */}
      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-6 lg:px-10 py-24">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-10">Quick questions</h2>
        <div className="space-y-3">
          <details className="group glass rounded-2xl p-5 open:border-orange-400/40">
            <summary className="flex justify-between items-center cursor-pointer font-semibold text-sm">
              Which campuses launch first?
              <span className="text-orange-400 group-open:rotate-45 transition-transform text-lg">+</span>
            </summary>
            <p className="text-white/55 text-sm mt-3 leading-relaxed">We're rolling out to 12 flagship campuses in August 2026, prioritized by waitlist density. Sign up and refer friends to boost your school.</p>
          </details>
          <details className="group glass rounded-2xl p-5 open:border-orange-400/40">
            <summary className="flex justify-between items-center cursor-pointer font-semibold text-sm">
              Is 2QT really free of platform fees?
              <span className="text-orange-400 group-open:rotate-45 transition-transform text-lg">+</span>
            </summary>
            <p className="text-white/55 text-sm mt-3 leading-relaxed">Yes — permanently. We partner directly with campus vendors instead of charging students hidden fees at checkout.</p>
          </details>
          <details className="group glass rounded-2xl p-5 open:border-orange-400/40">
            <summary className="flex justify-between items-center cursor-pointer font-semibold text-sm">
              How do you keep delivery hygienic?
              <span className="text-orange-400 group-open:rotate-45 transition-transform text-lg">+</span>
            </summary>
            <p className="text-white/55 text-sm mt-3 leading-relaxed">Every partner kitchen passes a hygiene audit, meals are sealed with tamper-evident tags, and runners follow strict handling protocols.</p>
          </details>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 border-t border-white/10 mt-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-display font-bold text-xs">2Q</div>
            <span className="font-display font-bold">2QT</span>
            <span className="text-white/35 text-sm ml-2">— delivered too quick.</span>
          </div>
          <p className="text-white/35 text-sm">© 2026 2QT, Inc. Made on a campus, for campuses.</p>
        </div>
      </footer>

      <LiveCounter />
    </div>
  );
}
