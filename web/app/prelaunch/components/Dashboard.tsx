import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, ChevronRight, Share2, Rocket, Lock, LogOut, Wallet, Gift } from 'lucide-react';
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

function calcWallet(referrals: number, surveyCompleted: boolean) {
  const base = surveyCompleted ? 100 : 0;
  const perRef = referrals * 10;
  const m5 = referrals >= 5 ? 25 : 0;
  const m10 = referrals >= 10 ? 50 : 0;
  return { base, perRef, m5, m10, total: base + perRef + m5 + m10 };
}

function nextMilestone(referrals: number): { target: number; bonus: number } | null {
  if (referrals < 5) return { target: 5, bonus: 25 };
  if (referrals < 10) return { target: 10, bonus: 50 };
  return null;
}

export function Dashboard({ rank, total, referrals, referralCode, name, surveyCompleted, onOpenSurvey, onLogout }: DashboardProps) {
  const [copied, setCopied] = useState(false);
  const wallet = calcWallet(referrals, surveyCompleted);
  const milestone = nextMilestone(referrals);

  const handleCopy = () => {
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/prelaunch?ref=${referralCode}`
      : `https://go2qt.com/prelaunch?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/prelaunch?ref=${referralCode}`
      : `https://go2qt.com/prelaunch?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join 2QT Waitlist',
          text: `Join the 2QT waitlist! Use my link — you get ₹100 & I get ₹10 per referral.`,
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

        {/* Wallet total */}
        <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
          <div>
            <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold mb-1 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Your Launch Wallet
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-display font-bold text-white">₹{wallet.total}</span>
              <span className="text-zinc-500 text-sm font-medium">on launch day</span>
            </div>
          </div>
          {referrals >= 10 && (
            <span className="shrink-0 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-bold">
              All Milestones Unlocked!
            </span>
          )}
        </div>

        {/* Breakdown */}
        <div className="space-y-2 relative z-10 mb-5">
          {/* Base reward */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${surveyCompleted ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
            <div className="flex items-center gap-2">
              {surveyCompleted
                ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                : <Lock className="w-4 h-4 text-amber-400 shrink-0" />}
              <span className={surveyCompleted ? 'text-green-300 font-medium' : 'text-amber-300 font-medium'}>
                Base reward {surveyCompleted ? '(survey completed)' : '— complete survey to unlock'}
              </span>
            </div>
            <span className={`font-bold ${surveyCompleted ? 'text-green-400' : 'text-amber-400'}`}>
              {surveyCompleted ? '+₹100' : '₹100 locked'}
            </span>
          </div>

          {/* Per-referral earnings */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3 text-sm bg-white/5 border border-white/8">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-brand-primary shrink-0" />
              <span className="text-zinc-300 font-medium">
                {referrals} referral{referrals !== 1 ? 's' : ''} × ₹10
              </span>
            </div>
            <span className="font-bold text-brand-primary">+₹{wallet.perRef}</span>
          </div>

          {/* Milestone: 5 referrals */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${wallet.m5 > 0 ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-white/5 border border-white/8 opacity-50'}`}>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400 shrink-0" />
              <span className={`font-medium ${wallet.m5 > 0 ? 'text-purple-300' : 'text-zinc-500'}`}>
                Milestone bonus — 5 referrals
              </span>
            </div>
            <span className={`font-bold ${wallet.m5 > 0 ? 'text-purple-400' : 'text-zinc-600'}`}>
              {wallet.m5 > 0 ? '+₹25' : '₹25'}
            </span>
          </div>

          {/* Milestone: 10 referrals */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${wallet.m10 > 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/5 border border-white/8 opacity-50'}`}>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className={`font-medium ${wallet.m10 > 0 ? 'text-yellow-300' : 'text-zinc-500'}`}>
                Milestone bonus — 10 referrals
              </span>
            </div>
            <span className={`font-bold ${wallet.m10 > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
              {wallet.m10 > 0 ? '+₹50' : '₹50'}
            </span>
          </div>
        </div>

        {/* Next milestone progress */}
        {milestone && (
          <div className="relative z-10 rounded-xl bg-black/20 border border-white/8 px-4 py-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-zinc-400 font-semibold">
                {milestone.target - referrals} more referral{milestone.target - referrals !== 1 ? 's' : ''} → unlock +₹{milestone.bonus} bonus
              </span>
              <span className="text-xs text-zinc-500 font-bold">{referrals}/{milestone.target}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-primary to-orange-400"
                initial={{ width: 0 }}
                animate={{ width: `${(referrals / milestone.target) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )}
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
          <p className="text-zinc-600 text-xs mt-1">+₹{referrals * 10} earned</p>
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
              <span>Complete survey — unlock ₹100 + boost rank 500 spots</span>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
