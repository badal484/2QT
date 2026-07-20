'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landing } from './components/Landing';
import { PhoneAuth } from './components/PhoneAuth';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app } from '../lib/firebase';
import { SurveyWizard, SurveyData } from './components/SurveyWizard';
import { Dashboard } from './components/Dashboard';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function StepRedirectToSurvey({ onRedirect }: { onRedirect: () => void }) {
  useEffect(() => { onRedirect(); }, [onRedirect]);
  return null;
}

export default function PreLaunchPage() {
  // Read referral code from URL if present
  const [referredBy, setReferredBy] = useState<string | null>(null);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [bgVideoUrl, setBgVideoUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      if (ref) setReferredBy(ref);
    }

    fetch('/api/proxy/prelaunch/config')
      .then(r => r.json())
      .then(d => { const v = d.config?.prelaunch_bg_video_url; if (v) setBgVideoUrl(String(v)); })
      .catch(() => {});

    // Keep Render free-tier backend warm — ping every 9 min to prevent cold starts
    const keepalive = setInterval(() => {
      fetch('/api/proxy/prelaunch/config').catch(() => {});
    }, 9 * 60 * 1000);

    const restoreSession = async () => {
      let unsubscribe = () => {};
      const savedToken = localStorage.getItem('2qt_auth_token');
      const urlRef = new URLSearchParams(window.location.search).get('ref');

      if (savedToken) {
        try {
          const meRes = await fetch('/api/proxy/prelaunch/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg91Token: savedToken, idToken: savedToken }),
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.registered) {
              // If a referral link is open and this session belongs to a DIFFERENT user,
              // sign them out immediately so the friend lands on the registration page.
              // Referral link = someone new wants to join. Always clear the existing
              // session so the friend sees the landing page, not the referrer's dashboard.
              if (urlRef) {
                localStorage.removeItem('2qt_auth_token');
                try { await signOut(getAuth(app)); } catch {}
                setIsInitializing(false);
                setStep(0);
                return unsubscribe;
              }
              // Upgrade stored token to the fresh long-lived sessionToken
              if (meData.sessionToken) {
                localStorage.setItem('2qt_auth_token', meData.sessionToken);
              }
              setIdToken(meData.sessionToken || savedToken);
              setUserName(meData.name || '');
              setReferralCode(meData.referral_code || '');
              setRankData({ rank: meData.rank || 0, total: meData.total || 0, referrals: meData.referrals || 0 });
              setSurveyCompleted(meData.survey_completed || false);
              if (!meData.survey_completed) {
                setStep(3); // Go straight to Survey
              } else {
                setStep(2); // Jump straight to Dashboard
              }
              setIsInitializing(false);
              return unsubscribe;
            } else {
              localStorage.removeItem('2qt_auth_token');
            }
          }
        } catch (error) {
          console.error("Session restore failed:", error);
        }
      }

      // Check for existing Firebase auth session on mount (fallback)
      const auth = getAuth(app);
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user && !savedToken) {
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
                if (!meData.survey_completed) {
                  setStep(3);
                } else {
                  setStep(2);
                }
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
      return unsubscribe;
    };

    let unsub: any;
    restoreSession().then(u => unsub = u);
    return () => { if(unsub) unsub(); clearInterval(keepalive); };
  }, []);

  const [step, setStep] = useState<number>(0);
  const [, setPhone] = useState('');
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
      localStorage.setItem('2qt_auth_token', data.token);
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
      // Clear any stale survey session from a previous test/user on this device
      sessionStorage.removeItem('2qt_survey_v2');
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
          const token = json.sessionToken || data.token;
          localStorage.setItem('2qt_auth_token', token);
          setIdToken(token);
          setReferralCode(json.data?.referral_code || json.referral_code || '');
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
        toast.success('Survey completed! Your free meal on launch is confirmed.');
        setRankData({ rank: json.data?.rank || rankData?.rank || 0, total: json.data?.total || rankData?.total || 0, referrals: json.data?.referrals || rankData?.referrals || 0 });
        setSurveyCompleted(true);
        setStep(2); // Back to Dashboard
      } else {
        throw new Error(json.message || json.error || 'Failed to submit');
      }
    } catch (e: any) {
      toast.error(e?.message && e.message !== 'Failed to submit' ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('2qt_auth_token');
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
      <style dangerouslySetInnerHTML={{ __html: `
        body { background-color: #05050A !important; }
        ::-webkit-scrollbar-track { background: #05050A !important; }
        ::-webkit-scrollbar-thumb { background: #333333 !important; border: 2px solid #05050A; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #555555 !important; }
      `}} />

      {/* Background video layer — z-0 sits above the dark outer bg */}
      {bgVideoUrl ? (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <video
            src={bgVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
      ) : (
        /* Animated glow layer — -z-10 fine when outer div is opaque dark */
        <div className="fixed inset-0 pointer-events-none -z-10 bg-[#05050A]">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-brand-primary/20 rounded-full blur-[120px]"
          />
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]"></div>
        </div>
      )}

      {/* All content at z-[1] so it floats above the video layer */}
      <div className="relative z-[1]">
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

        {/* Safety net: if somehow we reach step 2 without survey done, redirect to survey */}
        {step === 2 && !surveyCompleted && <StepRedirectToSurvey onRedirect={() => setStep(3)} />}

        {step === 2 && surveyCompleted && (
          <motion.div key="dashboard" initial="enter" animate="center" exit="exit" variants={variants} className="w-full min-h-screen flex flex-col items-center justify-center p-4">
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

    </div>
  );
}
