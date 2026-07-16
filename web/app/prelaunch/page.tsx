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

  const handlePhoneVerified = (verifiedPhone: string) => {
    setPhone(verifiedPhone);
    setStep(2);
  };

  const handleSurveyComplete = async (data: SurveyData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/proxy/prelaunch/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: '', // Not strictly collecting email right now, phone is main
          phone: phone,
          surveyResponses: data,
          referredBy: referredBy || undefined,
          source: 'waitlist_v2'
        })
      });

      const json = await res.json();
      if (res.ok) {
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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 relative font-sans overflow-x-hidden">
      
      {/* Global Background Layer */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-brand-accent/5 to-transparent" />
      </div>

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
                <p className="text-zinc-500 font-medium">Securing your launch reward...</p>
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
