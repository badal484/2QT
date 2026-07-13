import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ClipboardList, Loader2, X } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

const CHECKLIST_ITEMS = [
  { id: "clean_station", label: "Cleaned preparation station" },
  { id: "restock_containers", label: "Restocked takeaway containers" },
  { id: "turn_off_equip", label: "Turned off non-essential equipment" },
  { id: "waste_disposal", label: "Cleared all waste bins" },
  { id: "handover_notes", label: "Passed on active notes to next shift" },
];

export function ShiftHandoverModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = CHECKLIST_ITEMS.every(item => checkedItems[item.id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // In a fully developed backend, there would be a specific endpoint for shift handovers.
      // E.g., await api.post("/kitchen/shift-handover", { checklist: checkedItems, notes });
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network request
      toast.success("Shift handover submitted successfully");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit handover");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
              <ClipboardList className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-none">Shift Handover</h2>
              <p className="text-zinc-500 text-xs font-semibold mt-1">Complete checklist to end shift</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-3 mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Checklist</h3>
            {CHECKLIST_ITEMS.map((item) => {
              const isChecked = checkedItems[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${isChecked ? "bg-violet-500/10 border-violet-500/30" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                >
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? "bg-violet-500 border-violet-500" : "border-zinc-500"}`}>
                    {isChecked && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  </div>
                  <span className={`text-sm font-bold ${isChecked ? "text-violet-400" : "text-white"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Handover Notes (Optional)</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any low stock warnings, equipment issues, etc."
              className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 resize-none transition-colors"
            />
          </div>
        </div>

        <div className="p-6 pt-0 mt-auto">
          <button
            onClick={handleSubmit}
            disabled={!allChecked || submitting}
            className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center transition-all ${allChecked ? "bg-violet-500 text-white hover:bg-violet-600 shadow-[0_0_20px_rgba(139,92,246,0.3)]" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Handover"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
