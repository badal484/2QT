"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Smartphone, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import { useAuth } from "../providers";

import { Suspense } from 'react';

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
  const [devOtp, setDevOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { login } = useAuth()!;

  // Pre-warm Render backend — poll /health until it responds, then unlock the form
  useEffect(() => {
    let cancelled = false;
    const warmUp = async () => {
      for (let i = 0; i < 20; i++) {
        try {
          const res = await fetch('/api/proxy/health', { signal: AbortSignal.timeout(5000) });
          if (res.ok && !cancelled) { setServerReady(true); return; }
        } catch {}
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 3000));
      }
      if (!cancelled) setServerReady(true); // give up after ~60s, let them try anyway
    };
    warmUp();
    return () => { cancelled = true; };
  }, []);

  // Keep Render warm after server is ready — pings every 45s so it never sleeps mid-session
  useEffect(() => {
    if (!serverReady) return;
    const id = setInterval(() => {
      fetch('/api/proxy/health', { signal: AbortSignal.timeout(5000) }).catch(() => {});
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
    setDevOtp("");

    const hintTimer = setTimeout(() => {
      setLoadingMsg("Server is starting up, please wait...");
    }, 8000);

    try {
      const data = await api.sendOtp(digits);
      if (data?.devOtp) {
        setOtp(data.devOtp);
        setDevOtp(data.devOtp);
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg === 'SERVER_TIMEOUT' ? "Server took too long. Tap Continue to try again." : msg);
      return false;
    } finally {
      clearTimeout(hintTimer);
      setLoading(false);
      setLoadingMsg("");
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
    } else if (userRole === "super_admin") {
      router.push("/admin");
    } else if (userRole === "chef") {
      router.push("/kitchen");
    } else if (userRole === "rider") {
      router.push("/rider");
    } else {
      router.push("/menu");
    }
  };

  const handleVerifyOtp = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.verifyOtp(phone, otp, undefined);
      login(data.user);
      
      if (!data.user.name || data.user.name === "2QT User" || data.user.name === "2QT_User") {
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
                    { phone: "910000000000", role: "Admin", color: "text-purple-400", bg: "hover:bg-purple-500/10" },
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

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSendOtp}
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
                      className="w-full bg-black/40 border border-white/[0.1] rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/50 focus:bg-black/60 transition-all font-mono tracking-wide"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 font-medium text-center">
                    {error}
                  </motion.p>
                )}

                {!serverReady && (
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
                  type="submit"
                  disabled={loading || !serverReady}
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-brand-primary/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : !serverReady ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </button>
              </motion.form>
            ) : step === "otp" ? (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleVerifyOtp}
                className="space-y-6"
              >
                {devOtp && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 rounded-xl bg-brand-primary/15 border border-brand-primary/40 text-center"
                  >
                    <p className="text-xs text-zinc-400 mb-1">SMS not configured — your OTP:</p>
                    <p className="text-3xl font-black tracking-[0.5em] text-brand-primary">{devOtp}</p>
                  </motion.div>
                )}

                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-4 py-4 text-center text-3xl font-black tracking-[0.5em] text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/50 focus:bg-black/60 transition-all"
                    required
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
                    type="submit"
                    disabled={loading || otp.length < 6}
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
                    onClick={() => { setStep("phone"); setError(""); setOtp(""); }}
                    className="w-full text-sm font-semibold text-zinc-500 hover:text-white transition-colors py-2"
                  >
                    Use a different number
                  </button>
                </div>
              </motion.form>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-brand-primary rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
