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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-50 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
        className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-xl border border-zinc-100"
      >
        <Gift className="w-12 h-12 text-orange-500" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-6xl font-display font-bold text-zinc-900 tracking-tight mb-3"
      >
        You're on the list.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-lg md:text-xl text-zinc-500 font-medium mb-10 max-w-md"
      >
        Your spot is secured. We'll text you the moment 2QT goes live.
      </motion.p>

      {/* Reward card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="w-full bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-zinc-100 mb-8 relative overflow-hidden"
      >
        {/* Reward highlight */}
        <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-3xl p-8 mb-8 relative overflow-hidden text-center shadow-lg transform hover:scale-[1.02] transition-transform">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,white_2px,transparent_2px)] [background-size:16px_16px]"></div>
          <p className="text-white/90 text-sm font-bold tracking-widest uppercase mb-2 relative z-10">Your Launch Reward</p>
          <p className="text-7xl font-display font-bold text-white tracking-tighter mb-2 relative z-10 drop-shadow-md">₹100</p>
          <p className="text-white/90 text-sm font-semibold relative z-10">Added to your 2QT wallet on launch day</p>
        </div>

        {/* Launch date */}
        <div className="flex items-center justify-center gap-2 text-zinc-600 font-semibold mb-8 bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-6">
          <CalendarDays className="w-5 h-5 text-orange-500" />
          <span>Valid for <span className="text-orange-600 font-bold">7 days</span> from launch — <span className="text-orange-600 font-bold">August 2026</span></span>
        </div>

        {/* Share section */}
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Spread the word</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-zinc-100 rounded-full text-zinc-900 font-bold hover:bg-zinc-50 hover:border-zinc-200 transition-colors text-sm shadow-sm"
          >
            {copied ? <CheckCircle2 className="w-5 h-5 text-orange-500" /> : <Copy className="w-5 h-5 text-zinc-500" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-full text-white font-bold transition-all text-sm shadow-lg hover:shadow-xl"
            style={{ background: 'linear-gradient(to right, #ff7a45, #ff5722)' }}
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
        className="text-xs font-semibold text-zinc-400"
      >
        Reward credited automatically when you log in after launch.
      </motion.p>
    </motion.div>
  );
}
