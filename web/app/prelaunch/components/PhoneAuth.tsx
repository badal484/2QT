import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window { initSendOTP: any; sendOtp: any; verifyOtp: any; }
}

interface PhoneAuthProps {
  onVerified: (data: { phone: string; token: string; name: string; alreadyRegistered?: boolean; referralCode?: string; rank?: number; total?: number; referrals?: number; surveyCompleted?: boolean }) => void;
}

export function PhoneAuth({ onVerified }: PhoneAuthProps) {
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'NAME' | 'SUCCESS'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [pendingVerified, setPendingVerified] = useState<{ phone: string; token: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Inject MSG91 Widget Script in Custom UI Mode
    const script = document.createElement('script');
    script.src = "https://control.msg91.com/app/assets/otp-provider/otp-provider.js";
    script.async = true;
    script.onload = () => {
        if (window.initSendOTP) {
            window.initSendOTP({
                widgetId: "366772613253353536373236",
                tokenAuth: "524621TvewiLzS6a5add22P1",
                exposeMethods: true,
                success: (data: any) => {
                    const token = typeof data === 'string' ? data : data.message;
                    handleServerVerification(token);
                },
                failure: (error: any) => {
                    toast.error(error?.message || 'Failed to verify OTP');
                    setIsLoading(false);
                }
            });
        }
    };
    document.body.appendChild(script);

    return () => {
        if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleSendOTP = () => {
      if (phone.length !== 10) return toast.error('Please enter a valid 10-digit number');
      setIsLoading(true);
      
      if (window.sendOtp) {
          try {
              window.sendOtp(`91${phone}`);
              setStep('OTP');
              toast.success('OTP Sent!');
          } catch (e) {
              toast.error('Failed to send OTP');
          }
          setIsLoading(false);
      } else {
          toast.error('MSG91 SDK not loaded yet');
          setIsLoading(false);
      }
  };

  const handleVerifyOTP = () => {
      if (otp.length < 4) return toast.error('Enter valid OTP');
      setIsLoading(true);
      if (window.verifyOtp) {
          try {
              window.verifyOtp(otp);
              // The success callback defined in initSendOTP will handle the rest
          } catch (e) {
              toast.error('Failed to verify OTP');
              setIsLoading(false);
          }
      } else {
          toast.error('MSG91 SDK not loaded yet');
          setIsLoading(false);
      }
  };

  const handleServerVerification = async (msg91AccessToken: string) => {
    setIsLoading(true);
    try {
      const meRes = await fetch('/api/proxy/prelaunch/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg91Token: msg91AccessToken }),
      });
      
      const meData = await meRes.json();
      
      if (meRes.ok && meData.registered) {
        setStep('SUCCESS');
        setTimeout(() => onVerified({
          phone: `91${phone}`, 
          token: msg91AccessToken,
          name: meData.name || '',
          alreadyRegistered: true,
          referralCode: meData.referral_code,
          rank: meData.rank,
          total: meData.total,
          referrals: meData.referrals,
          surveyCompleted: meData.survey_completed || false,
        }), 1200);
      } else {
        setPendingVerified({ phone: `91${phone}`, token: msg91AccessToken });
        setStep('NAME');
      }
    } catch (err) {
      toast.error('Verification failed on server');
    } finally {
      setIsLoading(false);
    }
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
      <div className="bg-white/5 backdrop-blur-3xl rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-[0_0_50px_rgba(255,90,31,0.15)] border border-white/10 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-brand-primary/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-orange-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        
        <AnimatePresence mode="wait">
        {step === 'PHONE' && (
          <motion.div key="phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="relative z-10 flex flex-col items-center w-full">
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2 text-white drop-shadow-sm text-center">Welcome.</h2>
            <p className="text-zinc-400 font-medium mb-8 text-sm text-center">Enter your mobile number to join the waitlist.</p>
            
             <div className="w-full flex flex-col items-center gap-4">
                 <div className="relative w-full flex items-center bg-white/5 border-2 border-white/10 hover:border-white/20 rounded-full overflow-hidden transition-all focus-within:border-brand-primary/60 shadow-inner">
                    <span className="pl-5 font-bold text-zinc-400 text-lg border-r border-white/10 pr-3 py-3.5 sm:py-4">+91</span>
                    <input 
                        type="tel" 
                        placeholder="00000 00000" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                        className="w-full bg-transparent border-none py-3.5 sm:py-4 px-4 text-base sm:text-lg font-bold text-white tracking-widest outline-none placeholder:text-zinc-600"
                    />
                 </div>
                 
                 <button onClick={handleSendOTP} disabled={isLoading || phone.length !== 10}
                    className="w-full mt-4 group flex items-center justify-center gap-2 text-white py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-50 border border-brand-primary/50"
                    style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Send OTP</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                 </button>
             </div>
          </motion.div>
        )}

        {step === 'OTP' && (
          <motion.div key="otp" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="relative z-10 flex flex-col items-center w-full">
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2 text-white drop-shadow-sm text-center">Verify.</h2>
            <p className="text-zinc-400 font-medium mb-8 text-sm text-center">Enter the code sent to +91 {phone}</p>
            
             <div className="w-full flex flex-col items-center gap-4">
                 <div className="relative w-full">
                    <input 
                        type="number" 
                        placeholder="• • • • • •" 
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                        className="w-full bg-white/5 border-2 border-white/10 hover:border-white/20 rounded-full py-4 px-6 text-center text-2xl font-black text-white tracking-[0.5em] outline-none transition-all focus:bg-white/10 focus:border-brand-primary/60 shadow-inner placeholder:text-zinc-600"
                        autoFocus
                    />
                 </div>
                 
                 <button onClick={handleVerifyOTP} disabled={isLoading || otp.length < 4}
                    className="w-full mt-4 group flex items-center justify-center gap-2 text-white py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-50 border border-brand-primary/50"
                    style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Verify Code</span>}
                 </button>
                 
                 <button onClick={() => setStep('PHONE')} className="mt-4 text-xs font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors">
                     Change Phone Number
                 </button>
             </div>
          </motion.div>
        )}

        {step === 'NAME' && (
          <motion.div key="name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 w-full">
            <h2 className="text-3xl font-display font-bold tracking-tight mb-2 text-white drop-shadow-sm text-center">Almost there.</h2>
            <p className="text-zinc-400 font-medium mb-8 text-sm text-center">What should we call you?</p>
            <div className="space-y-6">
              <input
                type="text" autoFocus placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && submitName()}
                className="w-full bg-white/5 border-2 border-white/10 hover:border-white/20 rounded-full py-3.5 sm:py-4 px-5 sm:px-6 text-base sm:text-lg font-bold text-white tracking-wide outline-none transition-all focus:bg-white/10 focus:border-brand-primary/60 shadow-inner placeholder:text-zinc-600"
              />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full group flex items-center justify-center gap-2 text-white py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-50 border border-brand-primary/50"
                style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                <span>Continue</span>
              </button>
            </div>
          </motion.div>
        )}

        {step === 'SUCCESS' && (
          <motion.div key="success"
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
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
