import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
          >
            <div className="bg-zinc-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${isDanger ? "bg-red-500/10 text-red-500 shadow-red-500/20" : "bg-brand-primary/10 text-brand-primary shadow-brand-primary/20"}`}>
                  {isDanger ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                </div>
                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">{title}</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">{message}</p>
              </div>
              <div className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all shadow-lg ${
                    isDanger 
                      ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30" 
                      : "bg-brand-primary hover:bg-brand-primary-dark text-white shadow-brand-primary/30"
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
