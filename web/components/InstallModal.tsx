"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Monitor, Share, MoreVertical } from "lucide-react";

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNativeInstall: () => void;
  canNativeInstall: boolean;
}

export function InstallModal({ isOpen, onClose, onNativeInstall, canNativeInstall }: InstallModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden z-10"
          >
            <div className="p-6 md:p-8">
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors text-black/60 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <h3 className="text-2xl font-bold tracking-tight mb-2">Install 2QT App</h3>
                <p className="text-black/60 text-sm font-medium">Follow the instructions for your device to install the app natively.</p>
              </div>

              {canNativeInstall && (
                <div className="mb-6 pb-6 border-b border-black/5">
                  <button
                    onClick={onNativeInstall}
                    className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-primary/30 hover:bg-brand-primary-dark transition-all active:scale-[0.98]"
                  >
                    Install Now (1-Click)
                  </button>
                </div>
              )}

              <div className="space-y-6">
                {/* iOS */}
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center shrink-0">
                    <Smartphone className="w-6 h-6 text-black/70" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">iOS (Safari)</h4>
                    <p className="text-xs text-black/60 font-medium leading-relaxed">
                      Tap the <Share className="inline w-3 h-3 mx-1" /> Share icon at the bottom of the screen, then scroll down and select <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                </div>

                {/* Android */}
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Smartphone className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">Android (Chrome)</h4>
                    <p className="text-xs text-black/60 font-medium leading-relaxed">
                      Tap the <MoreVertical className="inline w-3 h-3 mx-1" /> 3-dot menu at the top right, then select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
                    </p>
                  </div>
                </div>

                {/* Desktop */}
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center shrink-0">
                    <Monitor className="w-6 h-6 text-black/70" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">Desktop</h4>
                    <p className="text-xs text-black/60 font-medium leading-relaxed">
                      Click the installation icon inside the right side of your browser's address bar.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
