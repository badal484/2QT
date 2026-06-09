"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, PlusSquare, X } from 'lucide-react';

export default function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        
        setIsIOS(isIosDevice);
        setIsStandalone(isStandaloneMode);

        if (isIosDevice && !isStandaloneMode) {
            // Show prompt after a short delay so it doesn't block immediate usage
            const timer = setTimeout(() => setShowPrompt(true), 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!isIOS || isStandalone || !showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 w-full z-[999] p-4 pb-8 bg-white/90 backdrop-blur-xl border-t border-black/10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-[32px]"
            >
                <button 
                    onClick={() => setShowPrompt(false)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
                >
                    <X className="w-4 h-4 text-black/40" />
                </button>

                <div className="flex flex-col items-center text-center pt-2">
                    <div className="w-16 h-16 bg-brand-primary rounded-[18px] mb-4 flex items-center justify-center shadow-lg shadow-brand-primary/30">
                        <span className="text-white font-black text-2xl tracking-tighter">2QT</span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-zinc-900 mb-2">Install 2QT App</h3>
                    <p className="text-zinc-500 font-medium text-sm max-w-[280px] mb-6">
                        Install our app for a faster experience and live tracking updates.
                    </p>

                    <div className="bg-zinc-50 border border-black/5 rounded-2xl p-4 w-full flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Share className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-zinc-900">1. Tap Share</p>
                            <p className="text-xs font-medium text-zinc-500">At the bottom of Safari</p>
                        </div>
                    </div>

                    <div className="w-px h-4 bg-black/10 my-1" />

                    <div className="bg-zinc-50 border border-black/5 rounded-2xl p-4 w-full flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                            <PlusSquare className="w-5 h-5 text-zinc-700" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-zinc-900">2. Add to Home Screen</p>
                            <p className="text-xs font-medium text-zinc-500">Scroll down to find it</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
