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
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#12121a] border border-white/10 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl z-10"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDanger ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-orange-500/10 text-orange-400 border border-orange-500/20"}`}>
                  {isDanger ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                </div>
                <button
                  onClick={onCancel}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm font-medium leading-relaxed">{message}</p>
            </div>

            <div className="p-4 sm:p-6 bg-white/[0.02] border-t border-white/5 flex items-center gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3.5 px-5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white font-bold text-sm transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer ${
                  isDanger 
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20"
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
