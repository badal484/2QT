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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto text-center"
    >
      <div className="bg-white/90 backdrop-blur-2xl border border-white p-8 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.06)] relative overflow-hidden">
        
        {/* Subtle gradient glow in background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-b from-brand-primary/10 to-transparent pointer-events-none" />

        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2, stiffness: 150, damping: 12 }}
          className="relative w-24 h-24 mx-auto mb-6"
        >
          <div className="absolute inset-0 rounded-full bg-brand-primary/20 animate-ping" />
          <div className="relative w-full h-full rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg shadow-brand-primary/30">
            <CheckCircle2 className="w-12 h-12" />
          </div>
        </motion.div>

        <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mb-2">You're on the list.</h1>
        <p className="text-zinc-600 font-medium mb-8">
          Welcome to the club. Your exclusive launch reward has been reserved.
        </p>

        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-5 mb-8 text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-accent/30 text-brand-primary-dark flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-zinc-900">Unlock a Bigger Reward</h3>
          </div>
          <p className="text-sm text-zinc-600 mb-4 font-medium leading-relaxed">
            Invite 3 friends to join the waitlist using your unique link and unlock a <strong className="text-zinc-900">Premium Welcome Kit</strong> on your first order.
          </p>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-800 truncate select-all">
              {referralLink}
            </div>
            <button 
              onClick={handleCopy}
              className="p-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors shrink-0"
              title="Copy Link"
            >
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button 
          onClick={handleShare}
          className="w-full group flex items-center justify-center gap-2 bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-transform active:scale-[0.98] shadow-lg shadow-zinc-900/20"
        >
          <Share2 className="w-5 h-5" />
          Share with Friends
        </button>

      </div>
    </motion.div>
  );
}
