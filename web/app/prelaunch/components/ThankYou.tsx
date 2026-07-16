import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, Share2, Sparkles, Gift } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface ThankYouProps {
  referralCode: string;
}

export function ThankYou({ referralCode }: ThankYouProps) {
  const [copied, setCopied] = useState(false);
  
  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/prelaunch?ref=${referralCode}` : `https://2qt.in/prelaunch?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join the 2QT Waitlist',
          text: 'I just joined the waitlist for 2QT! Use my link to sign up and unlock a premium launch reward.',
          url: referralLink,
        });
      } catch (e) {
        console.error('Share failed', e);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto flex flex-col items-center text-center"
    >
      <div className="w-24 h-24 bg-brand-primary/10 border border-brand-primary/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(255,107,53,0.2)]">
        <Gift className="w-12 h-12 text-brand-primary drop-shadow-[0_0_10px_rgba(255,107,53,0.5)]" />
      </div>

      <h1 className="text-4xl md:text-6xl font-black font-serif text-white tracking-tight mb-4">
        You're on the list.
      </h1>
      <p className="text-xl md:text-2xl text-zinc-400 mb-12">
        Your reward is locked in. We'll text you when 2QT launches.
      </p>

      <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="bg-brand-primary text-white p-6 rounded-2xl mb-8 shadow-[0_0_20px_rgba(255,107,53,0.3)]">
          <h3 className="text-xl font-bold font-serif mb-2">Exclusive Launch Box</h3>
          <p className="text-white/80">Secured for your first order.</p>
        </div>

        <div className="border-t border-white/10 pt-8">
          <h4 className="font-bold text-white mb-2 tracking-wide">SHARE WITH 3 FRIENDS TO UNLOCK:</h4>
          <p className="text-brand-primary font-black font-serif text-2xl mb-6 drop-shadow-[0_0_10px_rgba(255,107,53,0.3)]">₹500 Wallet Credit</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
            <button 
              onClick={handleCopy}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button 
              onClick={handleShare}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-primary-dark transition-colors shadow-[0_0_15px_rgba(255,107,53,0.4)]"
            >
              <Share2 className="w-5 h-5" />
              Share Link
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
