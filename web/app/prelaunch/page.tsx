'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landing } from './components/Landing';
import { PhoneAuth } from './components/PhoneAuth';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app } from '../lib/firebase';
import { SurveyWizard, SurveyData } from './components/SurveyWizard';
import { Dashboard } from './components/Dashboard';
import { LiveCounter } from './components/LiveCounter';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function PreLaunchPage() {
  // Read referral code from URL if present
  const [referredBy, setReferredBy] = useState<string | null>(null);
  
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      if (ref) setReferredBy(ref);
    }

    // Check for existing Firebase auth session on mount
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const meRes = await fetch('/api/proxy/prelaunch/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.registered) {
              setPhone(user.phoneNumber || '');
              setIdToken(token);
              setUserName(meData.name || '');
              setReferralCode(meData.referral_code || '');
              setRankData({ rank: meData.rank || 0, total: meData.total || 0, referrals: meData.referrals || 0 });
              setSurveyCompleted(meData.survey_completed || false);
              setStep(2); // Jump straight to Dashboard
            }
          } else {
            console.error("Session restore API error:", await meRes.text());
          }
        } catch (error) {
          console.error("Session restore failed:", error);
        }
      }
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const [step, setStep] = useState<number>(0);
  const [phone, setPhone] = useState('');
  const [idToken, setIdToken] = useState('');
  const [userName, setUserName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rankData, setRankData] = useState<{rank: number, total: number, referrals: number} | null>(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);


  const handlePhoneVerified = async (data: { phone: string; token: string; name: string; alreadyRegistered?: boolean; referralCode?: string; rank?: number; total?: number; referrals?: number; surveyCompleted?: boolean }) => {
    setPhone(data.phone);
    setIdToken(data.token);
    setUserName(data.name);

    if (data.alreadyRegistered) {
      setReferralCode(data.referralCode || '');
      setRankData({ rank: data.rank || 0, total: data.total || 0, referrals: data.referrals || 0 });
      setSurveyCompleted(data.surveyCompleted || false);
      if (!data.surveyCompleted) {
        setStep(3); // Go straight to Survey
      } else {
        setStep(2); // Go straight to Dashboard
      }
    } else {
      // Register immediately with empty survey to claim spot
      setIsSubmitting(true);
      setStep(1.5 as any); // Loading state
      try {
        const res = await fetch('/api/proxy/prelaunch/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            idToken: data.token,
            surveyResponses: {},
            referredBy: referredBy || undefined,
            source: 'waitlist_v2'
          })
        });

        const json = await res.json();
        if (res.ok) {
          setReferralCode(json.data?.referral_code || json.referral_code || '2QT-LAUNCH');
          setRankData({ rank: json.data?.rank || 0, total: json.data?.total || 0, referrals: json.data?.referrals || 0 });
          setSurveyCompleted(json.data?.survey_completed || false);
          
          if (!json.data?.survey_completed) {
            setStep(3); // Go straight to Survey
          } else {
            setStep(2); // Dashboard
          }
        } else {
          toast.error('Failed to register. Try again.');
          setStep(1);
        }
      } catch (e: any) {
        toast.error('Something went wrong. Please try again.');
        setStep(1);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSurveyComplete = async (data: SurveyData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/proxy/prelaunch/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          idToken: idToken,
          surveyResponses: data,
          referredBy: referredBy || undefined,
          source: 'waitlist_v2'
        })
      });

      const json = await res.json();
      if (res.ok) {
        sessionStorage.removeItem('2qt_survey_v2');
        toast.success('Survey completed! Your ₹100 reward is confirmed.');
        setRankData({ rank: json.data?.rank || rankData?.rank || 0, total: json.data?.total || rankData?.total || 0, referrals: json.data?.referrals || rankData?.referrals || 0 });
        setSurveyCompleted(true);
        setStep(2); // Back to Dashboard
      } else {
        throw new Error(json.error || 'Failed to submit');
      }
    } catch (e: any) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const auth = getAuth(app);
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out failed:", e);
    }
    setStep(0);
    setPhone('');
    setIdToken('');
    setUserName('');
    setReferralCode('');
    setRankData(null);
    setSurveyCompleted(false);
  };

  const variants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-zinc-100 relative font-sans overflow-x-hidden selection:bg-brand-primary selection:text-white">
      
      {/* Global Background Layer */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[#05050A]">
        {/* Animated Cinematic Glow */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-brand-primary/20 rounded-full blur-[120px]"
        />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]"></div>
      </div>

      <AnimatePresence mode="wait">
        {isInitializing ? (
          <motion.div key="initializing" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex flex-col items-center justify-center p-4">
            <Loader2 className="w-12 h-12 animate-spin text-brand-primary mb-4" />
            <p className="text-zinc-400 font-bold text-sm">Loading your session...</p>
          </motion.div>
        ) : step === 0 && (
          <motion.div key="hero" initial="enter" animate="center" exit="exit" variants={variants} className="w-full">
            <Landing onStart={() => setStep(1)} />
          </motion.div>
        )}

        {!isInitializing && step === 1 && (
          <motion.div key="phone" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex items-center justify-center p-4">
            <PhoneAuth onVerified={handlePhoneVerified} />
          </motion.div>
        )}

        {step === 1.5 && (
          <motion.div key="loading" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex flex-col items-center justify-center p-4">
            <Loader2 className="w-12 h-12 animate-spin text-brand-primary mb-4" />
            <p className="text-zinc-400 font-bold text-sm">Securing your spot in line...</p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="dashboard" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex items-center justify-center p-4">
             <Dashboard
               rank={rankData?.rank || 0}
               total={rankData?.total || 0}
               referrals={rankData?.referrals || 0}
               referralCode={referralCode}
               name={userName}
               surveyCompleted={surveyCompleted}
               onOpenSurvey={() => setStep(3)}
               onLogout={handleLogout}
             />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="survey" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex items-center justify-center p-4 md:p-8">
            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-brand-primary mb-4" />
                <p className="text-zinc-400 font-bold text-sm">Saving responses...</p>
              </div>
            ) : (
              <SurveyWizard onComplete={handleSurveyComplete} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
