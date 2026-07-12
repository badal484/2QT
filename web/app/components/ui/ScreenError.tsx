"use client";

import { RefreshCw, WifiOff, AlertCircle } from "lucide-react";

interface ScreenErrorProps {
  onRetry: () => void;
  message?: string;
  type?: "network" | "generic";
  className?: string;
}

export function ScreenError({
  onRetry,
  message = "Something went wrong",
  type = "generic",
  className = "",
}: ScreenErrorProps) {
  const Icon = type === "network" ? WifiOff : AlertCircle;
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-20 px-8 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-2">
        <Icon className="w-6 h-6 text-zinc-500" />
      </div>
      <p className="text-white font-bold text-base">{message}</p>
      <p className="text-zinc-500 text-sm">Pull to refresh or tap below</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 mt-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-dark transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try Again
      </button>
    </div>
  );
}
