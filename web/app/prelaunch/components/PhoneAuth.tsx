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
        try {
          const id = await window.recaptchaVerifier.render();
          window.grecaptcha?.reset(id);
        } catch {
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
      <div className="glass rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* ── PHONE ── */}
        {step === 'PHONE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2">Welcome.</h2>
            <p className="text-white/55 mb-8 text-sm">Enter your phone number to secure your spot.</p>
            <form onSubmit={handleSendOtp} className="space-y-6 relative z-10">
              <div className="relative flex items-center">
                <div className="absolute left-5 text-white/40 font-semibold pointer-events-none">+91</div>
                <input
                  type="tel" autoFocus placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 pl-16 pr-5 text-lg font-medium text-white tracking-wide outline-none transition-colors focus:bg-white/10 focus:border-orange-400/70"
                />
              </div>
              <button type="submit" disabled={phone.length < 10 || isLoading}
                className="w-full group flex items-center justify-center gap-2 btn-glow text-white py-3.5 rounded-full font-semibold text-sm transition-all disabled:opacity-50 disabled:pointer-events-none">
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
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2">Verify.</h2>
            <p className="text-white/55 mb-8 text-sm">
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
                    'w-10 h-12 md:w-12 md:h-14 text-center text-xl font-bold bg-white/5 border rounded-xl text-white outline-none transition-colors focus:bg-white/10 disabled:opacity-50',
                    otpError
                      ? 'border-red-500/50 focus:border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                      : 'border-white/10 focus:border-orange-400/70'
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
                  <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-center relative z-10">
              {resendCooldown > 0 ? (
                <p className="text-xs text-white/40 font-medium">
                  Resend code in <span className="text-white">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-xs text-white/40 font-medium hover:text-orange-400 underline underline-offset-4 transition-colors disabled:opacity-40"
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
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2">Almost there.</h2>
            <p className="text-white/55 mb-8 text-sm">What should we call you?</p>
            <div className="space-y-6 relative z-10">
              <input
                type="text" autoFocus placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && submitName()}
                className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 px-5 text-lg font-medium text-white tracking-wide outline-none transition-colors focus:bg-white/10 focus:border-orange-400/70 placeholder:text-white/30"
              />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full group flex items-center justify-center gap-2 btn-glow text-white py-3.5 rounded-full font-semibold text-sm transition-all disabled:opacity-50 disabled:pointer-events-none">
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'SUCCESS' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8 relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-20 h-20 glass rounded-full flex items-center justify-center mb-6 badge-ring"
            >
              <CheckCircle2 className="w-10 h-10 text-orange-400" />
            </motion.div>
            <h2 className="text-3xl font-display font-bold tracking-tight">Verified</h2>
            <p className="text-white/55 mt-2 text-sm">Hi {name} 👋</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
