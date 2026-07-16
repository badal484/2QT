import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { app } from '../../lib/firebase';
import { toast } from 'sonner';

declare global {
  interface Window {
    recaptchaVerifier: any;
    grecaptcha: any;
  }
}

interface PhoneAuthProps {
  onVerified: (phone: string) => void;
}

export function PhoneAuth({ onVerified }: PhoneAuthProps) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'SUCCESS'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // Firebase uses 6 digits
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    // Initialize reCAPTCHA when component mounts
    const auth = getAuth(app);
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      } catch (e) {
        console.error("Recaptcha Init Error", e);
      }
    }
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    
    setIsLoading(true);
    try {
      const auth = getAuth(app);
      const appVerifier = window.recaptchaVerifier;
      const fullPhone = `+91${phone}`;
      
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('OTP');
      toast.success('Verification code sent');
    } catch (error: any) {
      console.error("Firebase Auth Error", error);
      toast.error(error.message || 'Failed to send OTP. Please try again.');
      // Reset recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((widgetId: any) => {
          window.grecaptcha.reset(widgetId);
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (!confirmationResult) return;
    
    setIsLoading(true);
    try {
      await confirmationResult.confirm(code);
      setStep('SUCCESS');
      setTimeout(() => onVerified(phone), 1500);
    } catch (error: any) {
      console.error("Firebase Verify Error", error);
      toast.error('Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newOtp.join('');
    if (fullCode.length === 6) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative">
        
        {/* Invisible reCAPTCHA container for Firebase */}
        <div id="recaptcha-container"></div>
        
        {step === 'PHONE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Welcome.</h2>
            <p className="text-zinc-500 font-medium mb-8">Enter your phone number to secure your spot.</p>
            
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="relative flex items-center">
                <div className="absolute left-4 text-zinc-400 font-semibold text-lg pointer-events-none">
                  +91
                </div>
                <input 
                  type="tel"
                  autoFocus
                  placeholder="00000 00000"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl py-4 pl-16 pr-4 text-xl font-bold text-zinc-900 tracking-wide outline-none transition-all focus:bg-white focus:border-zinc-900 focus:shadow-[0_0_0_4px_rgba(0,0,0,0.05)]"
                />
              </div>

              <button 
                type="submit"
                disabled={phone.length < 10 || isLoading}
                className="w-full group flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:hover:bg-zinc-900"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'OTP' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Verify.</h2>
            <p className="text-zinc-500 font-medium mb-8">We sent a code to +91 {phone.slice(0,5)} {phone.slice(5)}</p>
            
            <div className="flex justify-between gap-2 mb-8">
              {otp.map((digit, i) => (
                <input 
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="tel"
                  maxLength={1}
                  autoFocus={i === 0}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={isLoading}
                  className="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-bold bg-zinc-50 border-2 border-zinc-100 rounded-xl text-zinc-900 outline-none transition-all focus:bg-white focus:border-zinc-900 disabled:opacity-50"
                />
              ))}
            </div>

            <div className="flex items-center justify-center min-h-[48px]">
              {isLoading && <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />}
            </div>
          </motion.div>
        )}

        {step === 'SUCCESS' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="flex flex-col items-center justify-center py-8"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-6"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Verified</h2>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}
