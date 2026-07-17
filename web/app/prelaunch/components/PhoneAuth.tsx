import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { app } from '../../lib/firebase';
import { toast } from 'sonner';

declare global {
  interface Window { recaptchaVerifier: any; grecaptcha: any; }
}

interface PhoneAuthProps {
  onVerified: (data: { phone: string; token: string; name: string; alreadyRegistered?: boolean; referralCode?: string; rank?: number; total?: number; referrals?: number; surveyCompleted?: boolean }) => void;
}

const RESEND_SECONDS = 60;

export function PhoneAuth({ onVerified }: PhoneAuthProps) {
  const [phone, setPhone]   = useState('');
  const [step, setStep]     = useState<'PHONE' | 'OTP' | 'NAME' | 'SUCCESS'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp]       = useState(['', '', '', '', '', '']);
  const [name, setName]     = useState('');
  const inputRefs           = useRef<(HTMLInputElement | null)[]>([]);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [pendingVerified, setPendingVerified]       = useState<{ phone: string; token: string } | null>(null);
  const [otpError, setOtpError]     = useState('');
  const [shakeKey, setShakeKey]     = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      try { window.recaptchaVerifier?.clear(); } catch {}
      window.recaptchaVerifier = null;
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_SECONDS);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async (phoneNumber: string) => {
    setIsLoading(true);
    try {
      const auth = getAuth(app);

      // Always create a fresh verifier and completely replace the DOM element 
      // to prevent "reCAPTCHA has already been rendered in this element" errors on Resend.
      try { window.recaptchaVerifier?.clear(); } catch {}
      
      const oldContainer = document.getElementById('recaptcha-container');
      if (oldContainer && oldContainer.parentNode) {
        const newContainer = document.createElement('div');
        newContainer.id = 'recaptcha-container';
        oldContainer.parentNode.replaceChild(newContainer, oldContainer);
      }

      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });

      const confirmation = await signInWithPhoneNumber(auth, `+91${phoneNumber}`, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      startCooldown();
      return true;
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/too-many-requests') {
        toast.error('Too many OTP requests. Please wait a few minutes before trying again.');
      } else if (code === 'auth/captcha-check-failed') {
        toast.error('Security check failed. Please refresh the page and try again.');
      } else if (code === 'auth/invalid-phone-number') {
        toast.error('Invalid phone number. Please check and try again.');
      } else {
        toast.error(`Failed to send OTP: ${error?.message || code}`);
      }
      try { window.recaptchaVerifier?.clear(); } catch {}
      window.recaptchaVerifier = null;
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    const ok = await sendOtp(phone);
    if (ok) setStep('OTP');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    const ok = await sendOtp(phone);
    if (ok) toast.success('New code sent');
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const handleVerify = async (code: string) => {
    if (!confirmationResult) return;
    setIsLoading(true);
    setOtpError('');
    try {
      const result = await confirmationResult.confirm(code);
      if (result.user) {
        const token = await result.user.getIdToken();
        const phoneNum = result.user.phoneNumber || phone;

        try {
          const meRes = await fetch('/api/proxy/prelaunch/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.registered) {
              setStep('SUCCESS');
              setTimeout(() => onVerified({
                phone: phoneNum, token,
                name: meData.name || '',
                alreadyRegistered: true,
                referralCode: meData.referral_code,
                rank: meData.rank,
                total: meData.total,
                referrals: meData.referrals,
                surveyCompleted: meData.survey_completed || false,
              }), 1200);
              return;
            }
          }
        } catch {}

        setPendingVerified({ phone: phoneNum, token });
        setStep('NAME');
      } else {
        throw new Error('User not found');
      }
    } catch (error: any) {
      setShakeKey(k => k + 1);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      const errCode = error?.code || '';
      if (errCode === 'auth/invalid-verification-code' || errCode === 'auth/code-expired') {
        setOtpError('That code is incorrect. Check and try again, or resend a new one.');
      } else if (errCode === 'auth/too-many-requests') {
        setOtpError('Too many attempts. Please wait a moment before trying again.');
      } else {
        setOtpError('Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    if (otpError) setOtpError('');
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.join('').length === 6) handleVerify(newOtp.join(''));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const submitName = () => {
    if (!pendingVerified || name.trim().length < 2) return;
    setStep('SUCCESS');
    setTimeout(() => onVerified({ ...pendingVerified, name: name.trim() }), 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-8 sm:p-10 shadow-[0_0_50px_rgba(255,90,31,0.15)] border border-white/10 relative">
        {/* Glow accent */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-primary/20 rounded-full blur-[60px] pointer-events-none"></div>
        {/* ── PHONE ── */}
        {step === 'PHONE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2 text-white drop-shadow-sm">Welcome.</h2>
            <p className="text-zinc-400 font-medium mb-8 text-sm">Enter your phone number to secure your spot.</p>
            <form onSubmit={handleSendOtp} className="space-y-6 relative z-10">
              <div className="relative flex items-center">
                <div className="absolute left-6 text-zinc-500 font-semibold pointer-events-none">+91</div>
                <input
                  type="tel" autoFocus placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-white/5 border-2 border-white/10 hover:border-white/20 rounded-full py-4 pl-16 pr-6 text-lg font-bold text-white tracking-wide outline-none transition-all focus:bg-white/10 focus:border-brand-primary/60 shadow-inner placeholder:text-zinc-600"
                />
              </div>
              <button type="submit" disabled={phone.length < 10 || isLoading}
                className="w-full group flex items-center justify-center gap-2 text-white py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-50 disabled:pointer-events-none border border-brand-primary/50"
                style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><span>Continue</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* ── OTP ── */}
        {step === 'OTP' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2 text-white drop-shadow-sm">Verify.</h2>
            <p className="text-zinc-400 font-medium mb-8 text-sm">
              We sent a code to +91 {phone.slice(0, 5)} {phone.slice(5)}
            </p>

            <motion.div
              key={shakeKey}
              animate={shakeKey > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="flex justify-between gap-2 mb-4 relative z-10"
            >
              {otp.map((digit, i) => (
                <input key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="tel" maxLength={1} autoFocus={i === 0}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={isLoading}
                  className={cn(
                    'w-10 h-12 md:w-12 md:h-14 text-center text-xl font-bold bg-white/5 border-2 rounded-2xl text-white outline-none transition-all disabled:opacity-50 shadow-inner',
                    otpError
                      ? 'border-red-500/80 focus:border-red-500 bg-red-500/10 text-white'
                      : 'border-white/10 hover:border-white/20 focus:border-brand-primary/60 focus:bg-white/10'
                  )}
                />
              ))}
            </motion.div>

            <div className="min-h-[36px] flex items-center relative z-10">
              {otpError ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-400 font-medium"
                >
                  {otpError}
                </motion.p>
              ) : isLoading ? (
                <div className="w-full flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-center relative z-10">
              {resendCooldown > 0 ? (
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                  Resend code in <span className="text-zinc-300 tabular-nums">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-xs text-zinc-500 font-bold uppercase tracking-wider hover:text-brand-primary underline underline-offset-4 transition-colors disabled:opacity-40"
                >
                  Didn't receive a code? Resend
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── NAME ── */}
        {step === 'NAME' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2 text-white drop-shadow-sm">Almost there.</h2>
            <p className="text-zinc-400 font-medium mb-8 text-sm">What should we call you?</p>
            <div className="space-y-6 relative z-10">
              <input
                type="text" autoFocus placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && submitName()}
                className="w-full bg-white/5 border-2 border-white/10 hover:border-white/20 rounded-full py-4 px-6 text-lg font-bold text-white tracking-wide outline-none transition-all focus:bg-white/10 focus:border-brand-primary/60 shadow-inner placeholder:text-zinc-600"
              />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full group flex items-center justify-center gap-2 text-white py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-50 disabled:pointer-events-none border border-brand-primary/50"
                style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 'SUCCESS' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8 relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,90,31,0.3)] border border-white/20"
            >
              <CheckCircle2 className="w-12 h-12 text-brand-primary drop-shadow-[0_0_8px_rgba(255,90,31,0.5)]" />
            </motion.div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-white drop-shadow-sm">Verified</h2>
            <p className="text-zinc-400 font-medium mt-2 text-sm">Hi {name} 👋</p>
          </motion.div>
        )}
      </div>
      
      {/* Firebase reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </motion.div>
  );
}
