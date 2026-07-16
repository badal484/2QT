'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, Share2, Gift, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface ThankYouProps {
  referralCode: string;
}

export function ThankYou({ referralCode }: ThankYouProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/prelaunch?ref=${referralCode}`
    : `https://go2qt.com/prelaunch?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join the 2QT Waitlist',
          text: "I just secured my ₹100 launch reward on 2QT! Join before we launch in August 2026.",
          url: shareUrl,
        });
      } catch { handleCopy(); }
    } else {
      handleCopy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl mx-auto flex flex-col items-center text-center py-8"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
        className="w-24 h-24 bg-brand-accent border-4 border-brand-dark flex items-center justify-center mb-8 shadow-[6px_6px_0px_#1A1A1A] rotate-[-2deg]"
      >
        <Gift className="w-12 h-12 text-brand-dark" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl md:text-7xl font-black font-serif text-brand-dark tracking-tight mb-3 uppercase"
      >
        You're on the list.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-lg md:text-xl text-brand-dark/80 font-bold mb-10 max-w-md uppercase tracking-wide"
      >
        Your spot is secured. We'll text you the moment 2QT goes live.
      </motion.p>

      {/* Reward card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="w-full bg-white border-4 border-brand-dark p-8 shadow-[8px_8px_0px_#1A1A1A] mb-8"
      >
        {/* Reward highlight */}
        <div className="bg-brand-primary border-4 border-brand-dark p-6 mb-8 shadow-[4px_4px_0px_#1A1A1A] relative overflow-hidden rotate-[1deg]">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, #1A1A1A 25%, transparent 25%, transparent 50%, #1A1A1A 50%, #1A1A1A 75%, transparent 75%, transparent)', backgroundSize: '10px 10px' }} />
          <p className="text-white text-sm font-black uppercase tracking-widest mb-1 relative z-10">Your Launch Reward</p>
          <p className="text-6xl font-black text-white font-serif tracking-tighter mb-1 relative z-10">₹100</p>
          <p className="text-white/90 text-sm font-bold uppercase relative z-10">Added to your 2QT wallet on launch day</p>
        </div>

        {/* Launch date */}
        <div className="flex items-center justify-center gap-2 text-brand-dark font-black uppercase mb-8 border-2 border-brand-dark bg-[#FFF7ED] py-3 px-4 shadow-[2px_2px_0px_#1A1A1A]">
          <CalendarDays className="w-5 h-5 text-brand-primary" />
          <span>Valid for <span className="text-brand-primary">7 days</span> from launch — <span className="text-brand-primary">August 2026</span></span>
        </div>

        {/* Share section */}
        <p className="text-sm font-black text-brand-dark uppercase tracking-widest mb-4">Spread the word</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-6 py-4 border-4 border-brand-dark bg-white text-brand-dark font-black uppercase tracking-wide hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_#1A1A1A] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all text-sm"
          >
            {copied ? <CheckCircle2 className="w-5 h-5 text-brand-primary" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-primary border-4 border-brand-dark text-white font-black uppercase tracking-wide hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_#1A1A1A] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all text-sm"
          >
            <Share2 className="w-5 h-5" />
            Share with Friends
          </button>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs font-bold text-brand-dark/60 uppercase tracking-widest"
      >
        Reward credited automatically when you log in after launch.
      </motion.p>
    </motion.div>
  );
}
