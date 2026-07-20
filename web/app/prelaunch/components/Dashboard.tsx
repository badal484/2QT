import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, ChevronRight, Share2, Rocket, Lock, LogOut, Wallet } from 'lucide-react';
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

  const handleCopy = async () => {
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/prelaunch?ref=${referralCode}`
      : `https://go2qt.com/prelaunch?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy the link manually.');
    }
  };

  const handleShare = async () => {
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/prelaunch?ref=${referralCode}`
      : `https://go2qt.com/prelaunch?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join 2QT Waitlist',
          text: `Join the 2QT waitlist! Use my link — you get a free meal on launch & I get ₹10 per referral.`,
          url: link,
        });
      } catch { handleCopy(); }
    } else {
      handleCopy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-3">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight">
          You're on the list, {name.split(' ')[0]}!
        </h1>
        <button
          onClick={onLogout}
          className="text-zinc-500 hover:text-white transition-colors text-[10px] sm:text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl hover:bg-white/5 whitespace-nowrap shrink-0 mt-1"
        >
          <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Sign Out
        </button>
      </div>

      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8"
      >
        <div className="absolute -top-10 -right-10 w-52 h-52 bg-brand-primary/15 rounded-full blur-[80px] pointer-events-none" />

        {/* Rewards header */}
        <div className="flex items-center justify-between mb-5 relative z-10">
          <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Your Launch Reward
          </p>
          {referrals >= 10 && (
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-bold">
              Top Referrer
            </span>
          )}
        </div>

        {/* Single reward row */}
        <div className={`flex items-center justify-between rounded-2xl px-5 py-4 relative z-10 ${surveyCompleted ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
          <div className="flex items-center gap-3">
            {surveyCompleted
              ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              : <Lock className="w-5 h-5 text-amber-400 shrink-0" />}
            <div>
              <p className={`font-semibold text-sm ${surveyCompleted ? 'text-white' : 'text-amber-200'}`}>
                Free meal on launch day
              </p>
              <p className={`text-xs mt-0.5 ${surveyCompleted ? 'text-green-400' : 'text-amber-500'}`}>
                {surveyCompleted ? 'Confirmed — we will notify you on launch' : 'Complete the survey to claim'}
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold uppercase tracking-widest ${surveyCompleted ? 'text-green-400' : 'text-amber-400'}`}>
            {surveyCompleted ? 'Confirmed' : 'Pending'}
          </span>
        </div>

        <div className="h-5" />
      </motion.div>

      {/* Rank + Referrals stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 text-center">
          <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold mb-1">Waitlist Position</p>
          <span className="text-4xl font-display font-bold text-white">#{rank.toLocaleString()}</span>
          {total > rank && (
            <p className="text-zinc-600 text-xs mt-1">{(total - rank).toLocaleString()} behind you</p>
          )}
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 text-center">
          <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold mb-1">Total Referrals</p>
          <span className="text-4xl font-display font-bold text-white">{referrals}</span>
          <p className="text-zinc-600 text-xs mt-1">{referrals === 0 ? 'Share to move up the list' : `${referrals} friend${referrals > 1 ? 's' : ''} joined`}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCopy}
            className="w-full sm:flex-1 bg-white/10 hover:bg-white/15 border border-white/10 transition-all rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-white text-sm"
          >
            {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="w-full sm:flex-[2] bg-brand-primary hover:bg-brand-primary-dark transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-white text-sm"
          >
            <Share2 className="w-5 h-5" />
            Share with Friends — earn ₹10 each
          </button>
        </div>

        {!surveyCompleted && (
          <button
            onClick={onOpenSurvey}
            className="w-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-all rounded-2xl py-4 flex items-center justify-between px-6 font-bold text-white group"
          >
            <div className="flex items-center gap-3">
              <Rocket className="w-5 h-5 text-amber-400 group-hover:-translate-y-1 transition-transform" />
              <span className="text-sm sm:text-base">Complete survey — unlock your free meal</span>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
