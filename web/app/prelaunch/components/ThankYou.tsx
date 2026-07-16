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
        className="w-24 h-24 bg-brand-primary/10 border border-brand-primary/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(255,107,53,0.2)]"
      >
        <Gift className="w-12 h-12 text-brand-primary drop-shadow-[0_0_12px_rgba(255,107,53,0.6)]" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-6xl font-black font-serif text-white tracking-tight mb-3"
      >
        You're on the list.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-lg md:text-xl text-zinc-400 mb-10 max-w-md"
      >
        Your spot is secured. We'll text you the moment 2QT goes live.
      </motion.p>

      {/* Reward card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] mb-8"
      >
        {/* Reward highlight */}
        <div className="bg-gradient-to-br from-brand-primary to-brand-primary-dark rounded-2xl p-6 mb-8 shadow-[0_0_30px_rgba(255,107,53,0.3)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent)]" />
          <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-1">Your Launch Reward</p>
          <p className="text-5xl font-black text-white font-serif tracking-tighter mb-1">₹100</p>
          <p className="text-white/80 text-sm font-medium">Added to your 2QT wallet on launch day</p>
        </div>

        {/* Launch date */}
        <div className="flex items-center justify-center gap-2 text-zinc-400 font-semibold mb-8 bg-white/5 rounded-xl py-3 px-4">
          <CalendarDays className="w-4 h-4 text-brand-primary" />
          <span>Valid for <span className="text-white">7 days</span> from launch — <span className="text-brand-primary">August 2026</span></span>
        </div>

        {/* Share section */}
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Spread the word</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors text-sm"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-brand-primary" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-primary-dark transition-colors shadow-[0_0_20px_rgba(255,107,53,0.3)] text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share with Friends
          </button>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-zinc-600"
      >
        Reward credited automatically when you log in after launch.
      </motion.p>
    </motion.div>
  );
}
