import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ClipboardCheck, Loader2, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

export function MorningPrepModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const data = await api.get("/kitchen/prep-list");
      setTasks(data.tasks || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load prep list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggle = async (taskId: string) => {
    setTogglingId(taskId);
    try {
      await api.post(`/kitchen/prep-list/${taskId}/toggle`, {});
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to update task");
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setIsAdding(true);
    try {
      await api.post("/kitchen/prep-list", { title, category: "General" });
      setNewTitle("");
      await fetchTasks();
    } catch (e: any) {
      toast.error(e.message || "Failed to add task");
    } finally {
      setIsAdding(false);
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
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <ClipboardCheck className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-none">Morning Prep</h2>
              <p className="text-zinc-500 text-xs font-semibold mt-1">Daily Checklist</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleAdd} className="flex items-center gap-3 mb-6">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a prep task..."
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors font-bold"
            />
            <button
              type="submit"
              disabled={isAdding || !newTitle.trim()}
              className="w-14 h-14 rounded-2xl bg-[#FF6B35] text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
            </button>
          </form>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <ClipboardCheck className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-bold">No tasks assigned for today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleToggle(task.id)}
                  disabled={togglingId === task.id}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                    task.completed
                      ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex-1 mr-4">
                    <span className={`text-sm font-bold ${task.completed ? "text-zinc-500 line-through" : "text-white"}`}>
                      {task.title}
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">{task.category}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    task.completed ? "bg-emerald-500 border-emerald-500" : "border-zinc-500"
                  }`}>
                    {togglingId === task.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : task.completed ? (
                      <Check className="w-5 h-5 text-zinc-900 stroke-[3]" />
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
