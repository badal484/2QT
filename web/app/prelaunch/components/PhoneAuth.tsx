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
  onVerified: (data: { phone: string; token: string; name: string; alreadyRegistered?: boolean; referralCode?: string }) => void;
}

const RESEND_SECONDS = 30;

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

  const rcContainerRef = useRef<HTMLDivElement | null>(null);

  const getOrCreateContainer = () => {
    if (!rcContainerRef.current) {
      const div = document.createElement('div');
      div.id = 'recaptcha-root';
      document.body.appendChild(div);
      rcContainerRef.current = div;
    }
    return rcContainerRef.current;
  };

  const buildVerifier = () => {
    const auth = getAuth(app);
    const container = getOrCreateContainer();
    window.recaptchaVerifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  };

  useEffect(() => {
    buildVerifier();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      try { window.recaptchaVerifier?.clear(); window.recaptchaVerifier = null; } catch {}
      rcContainerRef.current?.remove();
      rcContainerRef.current = null;
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

  const sendOtp = async (phoneNumber: string, isResend = false) => {
    setIsLoading(true);
    try {
      const auth = getAuth(app);

      if (isResend) {
        // Reset the token on the existing widget — don't destroy the container
        try {
          const id = await window.recaptchaVerifier.render();
          window.grecaptcha?.reset(id);
        } catch {
          // Reset failed — rebuild from scratch
          try { window.recaptchaVerifier?.clear(); } catch {}
          window.recaptchaVerifier = null;
          buildVerifier();
        }
      } else if (!window.recaptchaVerifier) {
        buildVerifier();
      }

      const confirmation = await signInWithPhoneNumber(auth, `+91${phoneNumber}`, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      startCooldown();
      return true;
    } catch (error: any) {
      const msg = error?.code || error?.message || String(error);
      console.error('OTP send failed:', error);
      toast.error(`Failed to send OTP: ${msg}`);
      // Rebuild verifier so next attempt starts clean
      try { window.recaptchaVerifier?.clear(); } catch {}
      window.recaptchaVerifier = null;
      try { buildVerifier(); } catch {}
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
    const ok = await sendOtp(phone, true);
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

        // Check registration before asking for name — skip NAME for returning users
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
              }), 1200);
              return;
            }
          }
        } catch {}

        // New user — ask for name
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
      <div className="bg-white border-4 border-brand-dark p-8 shadow-[8px_8px_0px_#1A1A1A] relative">

        {/* ── PHONE ── */}
        {step === 'PHONE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-4xl font-black font-serif text-brand-dark tracking-tight mb-2 uppercase">Welcome.</h2>
            <p className="text-brand-dark/70 font-bold mb-8 uppercase tracking-widest text-sm">Enter your phone number to secure your spot.</p>
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="relative flex items-center">
                <div className="absolute left-4 text-brand-dark/50 font-bold text-xl pointer-events-none">+91</div>
                <input
                  type="tel" autoFocus placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-[#FFF7ED] border-2 border-brand-dark py-4 pl-16 pr-4 text-xl font-black text-brand-dark tracking-wide outline-none transition-all focus:bg-white focus:border-brand-primary focus:shadow-[4px_4px_0px_#FF6B35]"
                />
              </div>
              <button type="submit" disabled={phone.length < 10 || isLoading}
                className="w-full group flex items-center justify-center gap-2 bg-brand-primary border-2 border-brand-dark shadow-[6px_6px_0px_#1A1A1A] text-white py-4 font-black text-lg uppercase tracking-wide hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none">
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <><span>Continue</span><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* ── OTP ── */}
        {step === 'OTP' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-4xl font-black font-serif text-brand-dark tracking-tight mb-2 uppercase">Verify.</h2>
            <p className="text-brand-dark/70 font-bold mb-8 uppercase tracking-widest text-sm">
              We sent a code to +91 {phone.slice(0, 5)} {phone.slice(5)}
            </p>

            {/* OTP boxes with shake on error */}
            <motion.div
              key={shakeKey}
              animate={shakeKey > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="flex justify-between gap-2 mb-4"
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
                    'w-12 h-14 md:w-14 md:h-16 text-center text-3xl font-black bg-[#FFF7ED] border-2 text-brand-dark outline-none transition-all focus:bg-white disabled:opacity-50',
                    otpError
                      ? 'border-red-500 bg-red-50 focus:border-red-500 shadow-[4px_4px_0px_#EF4444]'
                      : 'border-brand-dark focus:border-brand-primary focus:shadow-[4px_4px_0px_#FF6B35]'
                  )}
                />
              ))}
            </motion.div>

            {/* Inline error or spinner */}
            <div className="min-h-[36px] flex items-center">
              {otpError ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-400 font-medium"
                >
                  {otpError}
                </motion.p>
              ) : isLoading ? (
                <div className="w-full flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              ) : null}
            </div>

            {/* Resend link */}
            <div className="mt-4 flex items-center justify-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-brand-dark/60 font-bold uppercase">
                  Resend code in <span className="text-brand-dark tabular-nums">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-xs text-brand-dark/60 font-bold uppercase hover:text-brand-primary underline underline-offset-4 transition-colors disabled:opacity-40"
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
            <h2 className="text-4xl font-black font-serif text-brand-dark tracking-tight mb-2 uppercase">Almost there.</h2>
            <p className="text-brand-dark/70 font-bold mb-8 uppercase tracking-widest text-sm">What should we call you?</p>
            <div className="space-y-6">
              <input
                type="text" autoFocus placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && submitName()}
                className="w-full bg-[#FFF7ED] border-2 border-brand-dark py-4 px-5 text-xl font-black text-brand-dark tracking-wide outline-none transition-all focus:bg-white focus:border-brand-primary focus:shadow-[4px_4px_0px_#FF6B35] placeholder:text-brand-dark/30 placeholder:font-bold"
              />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full group flex items-center justify-center gap-2 bg-brand-primary border-2 border-brand-dark shadow-[6px_6px_0px_#1A1A1A] text-white py-4 font-black text-lg uppercase tracking-wide hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none">
                <span>Continue</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'SUCCESS' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-24 h-24 bg-brand-accent border-4 border-brand-dark text-brand-dark shadow-[6px_6px_0px_#1A1A1A] flex items-center justify-center mb-6 rotate-[2deg]"
            >
              <CheckCircle2 className="w-12 h-12" />
            </motion.div>
            <h2 className="text-4xl font-black font-serif text-brand-dark tracking-tight uppercase">Verified</h2>
            <p className="text-brand-dark/70 font-bold uppercase mt-2 tracking-widest text-sm">Hi {name} 👋</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
