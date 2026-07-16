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
  onVerified: (data: { phone: string; token: string; name: string }) => void;
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

  useEffect(() => {
    const auth = getAuth(app);
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      } catch (e) { console.error('Recaptcha init error', e); }
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; } catch {}
      }
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
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const confirmation = await signInWithPhoneNumber(auth, `+91${phoneNumber}`, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      startCooldown();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP. Please try again.');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((id: any) => window.grecaptcha.reset(id));
      }
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
        setPendingVerified({ phone: result.user.phoneNumber || phone, token });
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
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative">
        <div id="recaptcha-container" />

        {/* ── PHONE ── */}
        {step === 'PHONE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-bold font-serif text-white tracking-tight mb-2">Welcome.</h2>
            <p className="text-zinc-400 font-medium mb-8">Enter your phone number to secure your spot.</p>
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="relative flex items-center">
                <div className="absolute left-4 text-zinc-400 font-semibold text-lg pointer-events-none">+91</div>
                <input
                  type="tel" autoFocus placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-16 pr-4 text-xl font-bold text-white tracking-wide outline-none transition-all focus:bg-white/10 focus:border-brand-primary focus:shadow-[0_0_15px_rgba(255,107,53,0.2)]"
                />
              </div>
              <button type="submit" disabled={phone.length < 10 || isLoading}
                className="w-full group flex items-center justify-center gap-2 bg-gradient-to-r from-brand-primary to-brand-primary-dark shadow-[0_0_20px_rgba(255,107,53,0.3)] text-white py-4 rounded-2xl font-bold text-lg hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] transition-all disabled:opacity-50 disabled:shadow-none">
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
            <h2 className="text-3xl font-bold font-serif text-white tracking-tight mb-2">Verify.</h2>
            <p className="text-zinc-400 font-medium mb-8">
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
                    'w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-bold bg-white/5 border-2 rounded-xl text-white outline-none transition-all focus:bg-white/10 disabled:opacity-50',
                    otpError
                      ? 'border-red-500/70 bg-red-500/5 focus:border-red-400'
                      : 'border-white/10 focus:border-brand-primary'
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
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                </div>
              ) : null}
            </div>

            {/* Resend link */}
            <div className="mt-4 flex items-center justify-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-zinc-600">
                  Resend code in <span className="text-zinc-400 font-semibold tabular-nums">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-xs text-zinc-500 hover:text-brand-primary underline underline-offset-2 transition-colors disabled:opacity-40"
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
            <h2 className="text-3xl font-bold font-serif text-white tracking-tight mb-2">Almost there.</h2>
            <p className="text-zinc-400 font-medium mb-8">What should we call you?</p>
            <div className="space-y-6">
              <input
                type="text" autoFocus placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && submitName()}
                className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 px-5 text-xl font-bold text-white tracking-wide outline-none transition-all focus:bg-white/10 focus:border-brand-primary focus:shadow-[0_0_15px_rgba(255,107,53,0.2)] placeholder:text-zinc-600"
              />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full group flex items-center justify-center gap-2 bg-gradient-to-r from-brand-primary to-brand-primary-dark shadow-[0_0_20px_rgba(255,107,53,0.3)] text-white py-4 rounded-2xl font-bold text-lg hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] transition-all disabled:opacity-50 disabled:shadow-none">
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
              className="w-20 h-20 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary shadow-[0_0_30px_rgba(255,107,53,0.3)] flex items-center justify-center mb-6"
            >
              <CheckCircle2 className="w-10 h-10 drop-shadow-[0_0_10px_rgba(255,107,53,0.5)]" />
            </motion.div>
            <h2 className="text-2xl font-bold font-serif text-white tracking-tight">Verified</h2>
            <p className="text-zinc-500 text-sm mt-1">Hi {name} 👋</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
