"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth()!;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/proxy/auth/admin-pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Invalid PIN");
      }

      // Automatically store token
      if (typeof window !== "undefined") {
        localStorage.setItem("2qt_token", data.token);
        if (data.refreshToken) {
          localStorage.setItem("2qt_refresh_token", data.refreshToken);
        }
      }

      login(data.user);
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-brand-primary/30">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="absolute w-[40vw] h-[40vw] bg-brand-primary/20 blur-[140px] rounded-full translate-x-[-20%] translate-y-[-10%]" />
        <div className="absolute w-[35vw] h-[35vw] bg-violet-600/20 blur-[140px] rounded-full translate-x-[20%] translate-y-[10%]" />
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[2rem] border border-white/[0.08] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl mx-auto flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-zinc-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-2">
              Admin Portal
            </h1>
            <p className="text-zinc-400 text-sm">
              Enter secret PIN to access
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-5 py-4 text-center text-lg text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/50 focus:bg-black/60 transition-all tracking-widest font-mono"
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
              disabled={loading || !pin}
              className="w-full bg-white text-black py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>Unlock <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
