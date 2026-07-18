import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, ChevronRight, Share2, Rocket, Lock, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardProps {
  rank: number;
  total: number;
  referrals: number;
  referralCode: string;
  name: string;
  surveyCompleted: boolean;
  onOpenSurvey: () => void;
  onLogout: () => void;
}

export function Dashboard({ rank, total, referrals, referralCode, name, surveyCompleted, onOpenSurvey, onLogout }: DashboardProps) {
  const [copied, setCopied] = useState(false);
  const peopleBehind = Math.max(0, total - rank);

  const handleCopy = () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/prelaunch?ref=${referralCode}` : `https://2qt.in/prelaunch?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/prelaunch?ref=${referralCode}` : `https://2qt.in/prelaunch?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join 2QT Waitlist',
          text: 'I just joined the 2QT waitlist! Use my link to join and we both get rewards.',
          url: link,
        });
      } catch (e) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Welcome Banner */}
      <div className="flex justify-between items-start mb-6 sm:mb-8 gap-3 sm:gap-4">
        <div className="text-left">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white drop-shadow-sm leading-tight">You're on the list, {name.split(' ')[0]}!</h1>
        </div>
        <button 
          onClick={onLogout}
          className="text-zinc-500 hover:text-white transition-colors text-[10px] sm:text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl hover:bg-white/5 whitespace-nowrap shrink-0 mt-1 sm:mt-0"
        >
          <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Sign Out
        </button>
      </div>

      {/* ₹100 Reward Card */}
      {surveyCompleted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-4 rounded-2xl border border-green-500/40 bg-green-500/10 px-6 py-4 shadow-[0_0_24px_rgba(34,197,94,0.2)]"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-xl">✅</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">₹100 Launch Reward — Confirmed!</p>
            <p className="text-xs text-green-400 mt-0.5">Will be credited to your wallet on launch day.</p>
          </div>
        </motion.div>
      ) : (
        <motion.button
          onClick={onOpenSurvey}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          className="w-full flex items-center gap-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-6 py-4 shadow-[0_0_24px_rgba(245,158,11,0.2)] hover:bg-amber-500/15 transition-colors text-left"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xl">🔒</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">₹100 Launch Reward — Locked</p>
            <p className="text-xs text-amber-400 mt-0.5">Complete the survey below to confirm your reward →</p>
          </div>
          <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
        </motion.button>
      )}

      {/* Main Glass Card */}
      <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-6 sm:p-10 shadow-[0_0_50px_rgba(255,90,31,0.15)] border border-white/10 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Rank Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 sm:mb-10 relative z-10">
          <div className="text-center sm:text-left">
            <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold mb-1">Your Waitlist Position</p>
            <div className="flex items-baseline justify-center sm:justify-start gap-1">
              <span className="text-5xl font-display font-bold text-white">#{rank.toLocaleString()}</span>
            </div>

          </div>
          
          <div className="text-center sm:text-right bg-black/20 rounded-2xl p-4 border border-white/5 w-full sm:w-auto">
            <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold mb-1">Total Referrals</p>
            <span className="text-3xl font-display font-bold text-white">{referrals}</span>
          </div>
        </div>


        {/* Action Buttons */}
        <div className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleCopy}
              className="w-full sm:flex-1 bg-white/10 hover:bg-white/15 border border-white/10 transition-all rounded-2xl py-3.5 sm:py-4 flex items-center justify-center gap-2 font-bold text-white text-sm sm:text-base"
            >
              {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button 
              onClick={handleShare}
              className="w-full sm:flex-[2] bg-brand-primary hover:bg-brand-primary-dark transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] rounded-2xl py-3.5 sm:py-4 flex items-center justify-center gap-2 font-bold text-white text-sm sm:text-base"
            >
              <Share2 className="w-5 h-5" />
              Share with Friends
            </button>
          </div>
          
          {!surveyCompleted && (
            <button
              onClick={onOpenSurvey}
              className="w-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-all rounded-2xl py-4 flex items-center justify-between px-6 font-bold text-white group"
            >
              <div className="flex items-center gap-3">
                <Rocket className="w-5 h-5 text-amber-400 group-hover:-translate-y-1 transition-transform" />
                <span>Unlock ₹100 + boost rank by 500 spots</span>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
