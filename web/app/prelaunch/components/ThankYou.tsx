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
    : `https://2qt.in/prelaunch?ref=${referralCode}`;

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
      className="w-full max-w-2xl mx-auto flex flex-col items-center text-center py-8 relative z-10"
    >
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-500/20 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
        className="w-20 h-20 glass rounded-full flex items-center justify-center mb-8 badge-ring shadow-[0_0_30px_rgba(255,106,26,0.3)]"
      >
        <Gift className="w-10 h-10 text-orange-400" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-6xl font-display font-bold text-white tracking-tight mb-3"
      >
        You're on the list.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-lg md:text-xl text-white/70 font-medium mb-10 max-w-md"
      >
        Your spot is secured. We'll text you the moment 2QT goes live.
      </motion.p>

      {/* Reward card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="w-full glass rounded-3xl p-8 md:p-10 shadow-2xl mb-8 relative overflow-hidden"
      >
        {/* Reward highlight */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 mb-8 relative overflow-hidden text-center shadow-[0_10px_40px_rgba(255,106,26,0.4)] transform hover:scale-[1.02] transition-transform">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <p className="text-white/90 text-sm font-semibold tracking-widest uppercase mb-2 relative z-10">Your Launch Reward</p>
          <p className="text-7xl font-display font-bold text-white tracking-tighter mb-2 relative z-10 num-glow">₹100</p>
          <p className="text-white/80 text-sm font-medium relative z-10">Added to your 2QT wallet on launch day</p>
        </div>

        {/* Launch date */}
        <div className="flex items-center justify-center gap-2 text-white/80 font-medium mb-8 bg-white/5 border border-white/10 rounded-xl py-3 px-5">
          <CalendarDays className="w-5 h-5 text-orange-400" />
          <span>Valid for <span className="text-orange-300 font-semibold">7 days</span> from launch — <span className="text-orange-300 font-semibold">August 2026</span></span>
        </div>

        {/* Share section */}
        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Spread the word</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-6 py-4 glass rounded-full text-white font-semibold hover:bg-white/10 transition-colors text-sm border-white/10"
          >
            {copied ? <CheckCircle2 className="w-5 h-5 text-orange-400" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-6 py-4 btn-glow rounded-full text-white font-semibold transition-all text-sm"
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
        className="text-xs font-medium text-white/40"
      >
        Reward credited automatically when you log in after launch.
      </motion.p>
    </motion.div>
  );
}
