'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landing } from './components/Landing';
import { PhoneAuth } from './components/PhoneAuth';
import { SurveyWizard, SurveyData } from './components/SurveyWizard';
import { ThankYou } from './components/ThankYou';
import { LiveCounter } from './components/LiveCounter';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function PreLaunchPage() {
  // Read referral code from URL if present
  const [referredBy, setReferredBy] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      if (ref) setReferredBy(ref);
    }
  }, []);

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [phone, setPhone] = useState('');
  const [idToken, setIdToken] = useState('');
  const [userName, setUserName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FOMO Toasts
  useEffect(() => {
    if (step !== 0) return;
    
    const colleges = ["St. Xavier's", "Presidency", "Jadavpur", "Christ University", "SRM", "VIT"];
    
    const interval = setInterval(() => {
      const r = Math.random();
      if (r > 0.6) {
        const college = colleges[Math.floor(Math.random() * colleges.length)];
        toast(`Someone from ${college} just claimed a reward.`, {
          icon: '🔥',
          position: 'bottom-left',
          duration: 4000,
          style: { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', color: '#111', fontWeight: 600 }
        });
      }
    }, 12000);
    
    return () => clearInterval(interval);
  }, [step]);

  const handlePhoneVerified = (data: { phone: string; token: string; name: string; alreadyRegistered?: boolean; referralCode?: string }) => {
    setPhone(data.phone);
    setIdToken(data.token);
    setUserName(data.name);
    if (data.alreadyRegistered && data.referralCode) {
      setReferralCode(data.referralCode);
      setStep(3); // already registered — go straight to Thank You
      return;
    }
    setStep(2);
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
        setReferralCode(json.data?.referral_code || json.referral_code || '2QT-LAUNCH');
        setStep(3);
      } else {
        throw new Error(json.error || 'Failed to submit');
      }
    } catch (e: any) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const variants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-white relative font-sans overflow-x-hidden">
      
      {/* Global Background Layer */}
      <div className="fixed inset-0 grid-bg pointer-events-none -z-10"></div>
      <div className="fixed -top-40 -left-32 w-[560px] h-[560px] bg-orange-600/25 rounded-full blur-[130px] blob pointer-events-none -z-10"></div>
      <div className="fixed top-1/3 -right-40 w-[520px] h-[520px] bg-orange-500/15 rounded-full blur-[140px] blob pointer-events-none -z-10" style={{ animationDelay: '4s' }}></div>
      <div className="fixed bottom-0 left-1/4 w-[460px] h-[460px] bg-orange-700/20 rounded-full blur-[130px] blob pointer-events-none -z-10" style={{ animationDelay: '8s' }}></div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="hero" initial="enter" animate="center" exit="exit" variants={variants} className="w-full">
            <Landing onStart={() => setStep(1)} />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="phone" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex items-center justify-center p-4">
            <PhoneAuth onVerified={handlePhoneVerified} />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="survey" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex items-center justify-center p-4 md:p-8">
            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-brand-primary mb-4" />
                <p className="text-white/70 font-display font-bold text-sm">Securing your launch reward...</p>
              </div>
            ) : (
              <SurveyWizard onComplete={handleSurveyComplete} />
            )}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="thankyou" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex items-center justify-center p-4">
            <ThankYou referralCode={referralCode} />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
