import { Hero } from './Hero';
import { Showcase } from './Showcase';
import { About } from './About';
import { SocialProof } from './SocialProof';
import { Countdown } from './Countdown';
import { LiveCounter } from './LiveCounter';

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full flex flex-col">
      <Hero onStart={onStart} />

      <div id="showcase-section">
        <Showcase />
      </div>

      <About />

      <SocialProof />

      <Countdown />

      <LiveCounter />
    </div>
  );
}
