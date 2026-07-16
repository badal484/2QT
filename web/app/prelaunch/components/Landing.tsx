import React from 'react';
import { Hero } from './Hero';
import { Showcase } from './Showcase';
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
      
      <SocialProof />
      
      <Countdown />
      
      {/* The LiveCounter floats on top of everything */}
      <LiveCounter />
    </div>
  );
}
