"use client";

export default function OfflinePage() {
    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 text-center font-sans">
            <div className="w-32 h-32 mb-8 relative opacity-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full text-zinc-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9.9 4.25a9 9 0 0111.85 11.85M5.05 5.05A9 9 0 0018.95 18.95" />
                </svg>
            </div>
            <h1 className="text-4xl font-bold text-zinc-900 mb-4 tracking-tight">You're Offline</h1>
            <p className="text-zinc-500 font-medium max-w-sm mb-12 text-lg">
                It seems you've lost your connection. We're keeping your cart warm until you're back online.
            </p>
            <button
                onClick={() => window.location.reload()}
                className="bg-brand-primary text-white px-10 py-4 rounded-2xl font-semibold text-lg shadow-[0_15px_40px_-10px_rgba(255,107,53,0.5)] hover:scale-105 active:scale-95 transition-all"
            >
                Try Reconnecting
            </button>
            <p className="mt-8 text-sm text-zinc-400 font-medium">
                2QT Food Palace
            </p>
        </div>
    );
}
