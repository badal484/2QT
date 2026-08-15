"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Smartphone, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import { useAuth } from "../providers";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

declare global {
  interface Window { initSendOTP: any; sendOtp: any; verifyOtp: any; }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"phone" | "otp" | "onboarding">("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [serverReady, setServerReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  // MSG91 only assigns a reqId once sendOtp()'s own success callback fires — verifying
  // before that (e.g. a fast typer, or a resend fired right before verify) makes MSG91
  // reject with "reqId required". Gate verify on this instead of firing optimistically.
  const [otpConfirmedSent, setOtpConfirmedSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Only process the widget's global success callback when the user explicitly clicked
  // "Verify Code" — the widget can fire success on init from a cached session otherwise.
  const verifyCalledRef = useRef(false);
  const { login } = useAuth()!;

  // Load the MSG91 widget — with a safety timeout so slow networks/adblockers never freeze UI
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const script = document.createElement('script');
    script.src = 'https://control.msg91.com/app/assets/otp-provider/otp-provider.js';
    script.async = true;
    script.onload = () => {
      if (!window.initSendOTP) {
        setWidgetReady(true);
        return;
      }
      try {
        window.initSendOTP({
          widgetId: '366743654f50373431363431',
          tokenAuth: '524621TvewiLzS6a5add22P1',
          exposeMethods: true,
          success: (data: any) => {
            if (!verifyCalledRef.current) return;
            verifyCalledRef.current = false;
            if (data?.message) handleWidgetVerified(data.message);
          },
          failure: (err: any) => {
            verifyCalledRef.current = false;
            setLoading(false);
            const rawMsg = err?.message || '';
            const msg = String(rawMsg).toLowerCase().includes('already verif')
              ? 'This OTP code has already been used. Please click Resend OTP to get a new code.'
              : (rawMsg || 'Verification failed. Try again.');
            setError(msg);
          },
        });
        let pollCount = 0;
        pollRef.current = setInterval(() => {
          pollCount++;
          if (window.sendOtp || pollCount > 15) {
            setWidgetReady(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }, 100);
      } catch {
        setWidgetReady(true);
      }
    };
    script.onerror = () => {
      // Graceful fallback to direct API OTP when widget fails to load
      setWidgetReady(true);
    };

    // Safety fallback: if widget isn't ready within 1.5s, unblock UI so direct API can be used
    timeoutId = setTimeout(() => {
      setWidgetReady(true);
    }, 1500);

    document.body.appendChild(script);
    return () => {
      clearTimeout(timeoutId);
      verifyCalledRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      try { document.body.removeChild(script); } catch {}
    };
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // Pre-warm Render backend — immediately unlock UI on local dev
  useEffect(() => {
    let cancelled = false;
    setServerReady(true);
    const warmUp = async () => {
      try {
        const res = await fetch('https://twoqt-3kjw.onrender.com/api/v1/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok && !cancelled) setServerReady(true);
      } catch {}
    };
    warmUp();
    return () => { cancelled = true; };
  }, []);

  // Keep Render warm after server is ready — pings every 45s so it never sleeps mid-session
  useEffect(() => {
    if (!serverReady) return;
    const id = setInterval(() => {
      fetch('https://twoqt-3kjw.onrender.com/api/v1/health', { signal: AbortSignal.timeout(5000) }).catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, [serverReady]);

  const startCooldown = (seconds = 30) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtpRequest = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number (at least 10 digits)");
      return false;
    }
    setLoading(true);
    setError("");
    setLoadingMsg("");
    setOtpConfirmedSent(false);

    try {
      sessionStorage.clear();
      Object.keys(localStorage)
        .filter(k => k !== '2qt_token' && k !== '2qt_refresh_token' && k !== '2qt_user')
        .forEach(k => localStorage.removeItem(k));
    } catch {}



    const isTestAccount = ["919999999999", "9999999999", "917892493486", "7892493486", "912222222222", "2222222222", "913333333333", "3333333333"].includes(digits);

    if (window.sendOtp && !isTestAccount) {
      return new Promise<boolean>((resolve) => {
        try {
          window.sendOtp(
            `91${digits}`,
            () => {
              setOtpConfirmedSent(true);
              setLoading(false);
              resolve(true);
            },
            () => {
              // MSG91 widget failed / 403 -> fallback to backend direct OTP
              api.sendOtp(`91${digits}`)
                .then(() => {
                  setOtpConfirmedSent(true);
                  setLoading(false);
                  resolve(true);
                })
                .catch((apiErr: any) => {
                  setError(apiErr?.message || "Failed to send OTP. Please try again.");
                  setLoading(false);
                  resolve(false);
                });
            },
          );
        } catch {
          api.sendOtp(`91${digits}`)
            .then(() => {
              setOtpConfirmedSent(true);
              setLoading(false);
              resolve(true);
            })
            .catch((apiErr: any) => {
              setError(apiErr?.message || "Failed to send OTP. Please try again.");
              setLoading(false);
              resolve(false);
            });
        }
      });
    }

    // Direct API fallback
    try {
      await api.sendOtp(`91${digits}`);
      setOtpConfirmedSent(true);
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to send OTP. Please try again.");
      setLoading(false);
      return false;
    }
  };

  const handleSendOtp = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const ok = await sendOtpRequest();
    if (ok) {
      setStep("otp");
      startCooldown(30);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    const ok = await sendOtpRequest();
    if (ok) startCooldown(30);
  };

  const redirectUser = (userRole: string) => {
    const redirectUrl = searchParams.get("redirect");
    if (redirectUrl && redirectUrl.startsWith("/")) {
      router.push(redirectUrl);
    } else if (userRole === "super_admin" || userRole === "admin") {
      router.push("/admin");
    } else if (userRole === "finance") {
      router.push("/finance");
    } else if (userRole === "partner_kitchen") {
      router.push("/kitchen-portal");
    } else if (userRole === "dine_in_staff") {
      router.push("/restaurant");
    } else if (userRole === "chef" || userRole === "kitchen_manager") {
      router.push("/kitchen");
    } else if (userRole === "rider" || userRole === "rider_captain") {
      router.push("/rider");
    } else {
      router.push("/menu");
    }
  };

  const handleVerifyOtp = async (e: { preventDefault(): void } | any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (otp.length < 6) return;
    setLoading(true);
    setError("");

    const digits = phone.replace(/\D/g, "");
    const isTestAccount = ["919999999999", "9999999999", "917892493486", "7892493486", "912222222222", "2222222222", "913333333333", "3333333333"].includes(digits);

    if (window.verifyOtp && otpConfirmedSent && !isTestAccount) {
      verifyCalledRef.current = true;
      try {
        window.verifyOtp(otp);
      } catch (err: any) {
        verifyCalledRef.current = false;
        setError(err?.message || "Verification error. Try again.");
        setLoading(false);
      }
      return;
    }

    // Direct API fallback
    try {
      const digits = phone.replace(/\D/g, "");
      const referralCode = searchParams.get("referral") || undefined;
      const data = await api.verifyOtp(`91${digits}`, otp, referralCode);
      login(data.user);
      if (!data.user.name || data.user.name === "2QT User") {
        setStep("onboarding");
      } else {
        redirectUser(data.user.role);
      }
    } catch (err: any) {
      const rawMsg = err?.message || '';
      const msg = String(rawMsg).toLowerCase().includes('already verif')
        ? 'This OTP code has already been used. Please click Resend OTP to get a new code.'
        : (rawMsg || 'Verification failed. Try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Fired from the widget's global success callback (registered in initSendOTP above) once
  // MSG91 has verified the OTP — msg91Token is then verified server-side, same as the
  // mobile app's widget flow, via the shared /auth/verify-widget-token endpoint.
  const handleWidgetVerified = async (msg91Token: string) => {
    setLoading(true);
    setError("");
    try {
      const referralCode = searchParams.get("referral") || undefined;
      const data = await api.verifyWidgetToken(msg91Token, referralCode);
      login(data.user);

      if (!data.user.name || data.user.name === "2QT User") {
        setStep("onboarding");
      } else {
        redirectUser(data.user.role);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const updatedUser = await api.updateProfile({ name: name.trim() });
      login(updatedUser);
      redirectUser(updatedUser.role);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-brand-primary/30">
      
      {/* Ambient glowing background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="absolute w-[40vw] h-[40vw] bg-brand-primary/20 blur-[140px] rounded-full translate-x-[-20%] translate-y-[-10%]" />
        <div className="absolute w-[35vw] h-[35vw] bg-violet-600/20 blur-[140px] rounded-full translate-x-[20%] translate-y-[10%]" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Back */}
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-white transition-colors z-20 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Card */}
        <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[2rem] border border-white/[0.08] p-10 shadow-2xl relative overflow-hidden">
          
          {/* Subtle top glare */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-gradient-to-tr from-brand-primary to-orange-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-brand-primary/20 rotate-3 group-hover:rotate-6 transition-transform">
              <span className="text-white text-lg font-black tracking-tighter">2QT</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2">
              {step === "phone" ? "Sign in to 2QT" : step === "otp" ? "Verify your identity" : "Welcome aboard"}
            </h1>
            <p className="text-zinc-400 text-sm">
              {step === "phone" ? "Enter your phone number to continue" : step === "otp" ? "We've sent a code to your phone" : "Let's get your profile set up"}
            </p>
          </div>

          {/* Dev OTP hint */}
          {mounted && (
            <AnimatePresence>
              {step === "otp" && process.env.NODE_ENV === "development" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4 text-brand-primary shrink-0" />
                    <p className="text-xs font-semibold text-brand-primary">
                      Dev mode — use <span className="font-black tracking-widest text-white">123456</span>
                    </p>
                  </div>
                </motion.div>
              )}
              {step === "phone" && process.env.NODE_ENV === "development" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center justify-center gap-1.5 mb-2">
                      <Shield className="w-3.5 h-3.5" /> Dev Test Accounts
                    </p>
                    {[
                      { phone: "919999999999", role: "Customer", color: "text-emerald-400", bg: "hover:bg-emerald-500/10" },
                      { phone: "917892493486", role: "Admin", color: "text-purple-400", bg: "hover:bg-purple-500/10" },
                      { phone: "912222222222", role: "Chef", color: "text-orange-400", bg: "hover:bg-orange-500/10" },
                      { phone: "913333333333", role: "Rider", color: "text-blue-400", bg: "hover:bg-blue-500/10" },
                    ].map(a => (
                      <button
                        key={a.phone}
                        type="button"
                        onClick={() => setPhone(a.phone)}
                        className={`w-full text-left px-4 py-2.5 rounded-lg transition-colors flex items-center justify-between border border-transparent hover:border-white/[0.05] ${a.bg}`}
                      >
                        <span className="text-sm font-mono text-zinc-300 tracking-wider">{a.phone}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${a.color}`}>{a.role}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendOtp(e as any);
                      }}
                      className="w-full bg-black/40 border border-white/[0.1] rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/50 focus:bg-black/60 transition-all font-mono tracking-wide"
                    />
                  </div>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 font-medium text-center">
                    {error}
                  </motion.p>
                )}

                {mounted && (!serverReady || !widgetReady) && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-zinc-400 text-center">
                    Connecting to server...
                  </motion.p>
                )}

                {loadingMsg && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-zinc-400 text-center">
                    {loadingMsg}
                  </motion.p>
                )}

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || (mounted && (!serverReady || !widgetReady))}
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-brand-primary/20"
                >
                  {loading || (mounted && (!serverReady || !widgetReady)) ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </button>
              </motion.div>
            ) : step === "otp" ? (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyOtp(e as any);
                    }}
                    className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-4 py-4 text-center text-3xl font-black tracking-[0.5em] text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/50 focus:bg-black/60 transition-all"
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 font-medium text-center">
                    {error}
                  </motion.p>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length < 6 || !otpConfirmedSent}
                    className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-brand-primary/20"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Verify Code"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="w-full text-sm font-semibold text-zinc-500 hover:text-white transition-colors py-2 disabled:opacity-40"
                  >
                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setError(""); setOtp(""); setOtpConfirmedSent(false); verifyCalledRef.current = false; }}
                    className="w-full text-sm font-semibold text-zinc-500 hover:text-white transition-colors py-2"
                  >
                    Use a different number
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="onboarding"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleOnboarding}
                className="space-y-5"
              >
                <div>
                  <input
                    type="text"
                    placeholder="Full Name (e.g. John Doe)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-5 py-4 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/50 focus:bg-black/60 transition-all font-medium"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 font-medium text-center">
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-brand-primary/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Complete Setup"
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

const ClientLoginForm = dynamic(() => Promise.resolve(LoginForm), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505]">
      <div className="w-8 h-8 border-4 border-white/10 border-t-brand-primary rounded-full animate-spin" />
    </div>
  ),
});

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-brand-primary rounded-full animate-spin" />
      </div>
    }>
      <ClientLoginForm />
    </Suspense>
  );
}
