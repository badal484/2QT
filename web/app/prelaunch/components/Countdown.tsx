import { useEffect, useState } from 'react';

export function Countdown({ onStart }: { onStart: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const target = new Date('2026-08-01T00:00:00');
    const interval = setInterval(() => {
      const now = new Date();
      let diff = target.getTime() - now.getTime();
      if (diff < 0) diff = 0;
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60)
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 py-24 text-center text-white">
      <p className="text-xs font-bold tracking-[0.25em] text-orange-400 uppercase mb-3">T-Minus</p>
      <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-3">Touching down on campus</h2>
      <p className="text-white/55 mb-12">August 1st, 2026 — mark your calendar, tell your roommates.</p>

      <div className="grid grid-cols-4 gap-4 sm:gap-6 max-w-2xl mx-auto">
        <div className="glass rounded-3xl py-7 px-2 badge-ring">
          <p className="font-display text-4xl sm:text-6xl font-bold text-gradient num-glow">{String(timeLeft.days).padStart(3, '0')}</p>
          <p className="text-[11px] sm:text-xs text-white/45 mt-2 uppercase tracking-wider">Days</p>
        </div>
        <div className="glass rounded-3xl py-7 px-2 badge-ring">
          <p className="font-display text-4xl sm:text-6xl font-bold text-gradient num-glow">{String(timeLeft.hours).padStart(2, '0')}</p>
          <p className="text-[11px] sm:text-xs text-white/45 mt-2 uppercase tracking-wider">Hours</p>
        </div>
        <div className="glass rounded-3xl py-7 px-2 badge-ring">
          <p className="font-display text-4xl sm:text-6xl font-bold text-gradient num-glow">{String(timeLeft.mins).padStart(2, '0')}</p>
          <p className="text-[11px] sm:text-xs text-white/45 mt-2 uppercase tracking-wider">Minutes</p>
        </div>
        <div className="glass rounded-3xl py-7 px-2 badge-ring">
          <p className="font-display text-4xl sm:text-6xl font-bold text-gradient num-glow">{String(timeLeft.secs).padStart(2, '0')}</p>
          <p className="text-[11px] sm:text-xs text-white/45 mt-2 uppercase tracking-wider">Seconds</p>
        </div>
      </div>

      <div className="mt-16 max-w-lg mx-auto glass rounded-3xl p-8 sm:p-10 relative overflow-hidden text-center">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500/25 rounded-full blur-3xl"></div>
        <h3 className="font-display text-2xl font-bold relative z-10">Be first through the door.</h3>
        <p className="text-white/55 text-sm mt-2 relative z-10">Early sign-ups get founding-member perks + zero fees for life.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 relative z-10">
          <button onClick={onStart} className="btn-glow w-full px-6 py-4 rounded-full font-semibold text-sm whitespace-nowrap text-center">
            Join waitlist
          </button>
        </div>
      </div>
    </section>
  );
}
