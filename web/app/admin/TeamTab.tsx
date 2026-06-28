"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, X, RefreshCw, ShieldCheck, IndianRupee, UserX, Phone, ChefHat, Bike } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  finance:       { label: "Finance",       color: "text-emerald-400", bg: "bg-emerald-400/10", icon: IndianRupee },
  admin:         { label: "Admin",         color: "text-blue-400",    bg: "bg-blue-400/10",    icon: ShieldCheck },
  super_admin:   { label: "Super Admin",   color: "text-purple-400",  bg: "bg-purple-400/10",  icon: ShieldCheck },
  chef:            { label: "Chef",            color: "text-orange-400",  bg: "bg-orange-400/10",  icon: ChefHat },
  kitchen_manager: { label: "Kitchen Manager", color: "text-rose-400",    bg: "bg-rose-400/10",    icon: ChefHat },
  rider:           { label: "Rider",           color: "text-yellow-400",  bg: "bg-yellow-400/10",  icon: Bike },
  rider_captain:   { label: "Rider Captain",   color: "text-amber-400",   bg: "bg-amber-400/10",   icon: Bike },
};

function AddUserModal({ open, onAdd, onClose }: any) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"finance" | "admin" | "chef" | "kitchen_manager" | "rider">("finance");
  const [loading, setLoading] = useState(false);

  const reset = () => { setName(""); setPhone(""); setRole("finance" as any); };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return toast.error("Name and phone are required");
    setLoading(true);
    try {
      await onAdd(name, phone, role);
      reset();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Add Team Member</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-primary/50 placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Phone Number</label>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-3">
                <Phone className="w-4 h-4 text-white/30" />
                <span className="text-sm text-white/40">+91</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-primary/50 placeholder:text-white/20"
              />
            </div>
            <p className="text-xs text-white/30 mt-1.5">They'll log in using this phone number + OTP at <span className="text-white/50">2-qt.vercel.app/finance</span></p>
          </div>
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Role</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(["finance", "admin", "chef", "kitchen_manager", "rider"] as const).map(r => {
                const m = ROLE_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                      role === r
                        ? `${m.bg} ${m.color} border-current/30`
                        : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/30 mt-1.5">
              {role === "finance" && "Accesses /finance dashboard only"}
              {role === "admin" && "Accesses admin panel"}
              {role === "chef" && "Logs in at /kitchen — KDS only (order flow)"}
              {role === "kitchen_manager" && "Logs in at /kitchen — KDS + Dispatch (assign riders)"}
              {role === "rider" && "Logs in via the Rider mobile app"}
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
            className="w-full py-3.5 rounded-xl bg-brand-primary text-white font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? "Creating..." : "Create Team Member"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export function TeamTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/team/users");
      setUsers(res.users || []);
    } catch {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["new_user", "user_updated"], load);

  const handleAdd = async (name: string, phone: string, role: string) => {
    try {
      await api.post("/admin/team/users", { name, phone, role });
      toast.success(`${name} added as ${role}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
      throw e;
    }
  };

  const handleDeactivate = async (user: any) => {
    if (!confirm(`Deactivate ${user.name}? They will lose access.`)) return;
    try {
      await api.patch(`/admin/team/users/${user.id}/deactivate`, {});
      toast.success(`${user.name} deactivated`);
      await load();
    } catch {
      toast.error("Failed to deactivate");
    }
  };

  const financeUsers = users.filter(u => u.role === "finance");
  const adminUsers = users.filter(u => ["admin", "super_admin"].includes(u.role));
  const kitchenUsers = users.filter(u => ["chef", "kitchen_manager"].includes(u.role));
  const riderUsers = users.filter(u => ["rider", "rider_captain"].includes(u.role));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Team</h2>
          <p className="text-white/40 text-sm">Manage finance and admin access</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.07] flex items-center justify-center hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      {/* Access info cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 flex gap-3">
          <IndianRupee className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-emerald-400">Finance</div>
            <div className="text-xs text-white/40 mt-0.5">Login at <span className="font-mono text-white/60">/finance</span> · Phone + OTP</div>
          </div>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/15 rounded-2xl p-4 flex gap-3">
          <ChefHat className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-orange-400">Kitchen Staff</div>
            <div className="text-xs text-white/40 mt-0.5">Login at <span className="font-mono text-white/60">/kitchen</span> · Phone + OTP</div>
          </div>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-4 flex gap-3">
          <Bike className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-yellow-400">Riders</div>
            <div className="text-xs text-white/40 mt-0.5">Login via <span className="font-mono text-white/60">Rider App</span> · Phone + OTP</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Finance users */}
          <div>
            <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Finance Team ({financeUsers.length})</div>
            {financeUsers.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
                <IndianRupee className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No finance users yet.</p>
                <button onClick={() => setShowAdd(true)} className="text-emerald-400 text-sm font-bold mt-2 hover:underline">
                  Add one →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {financeUsers.map(u => (
                  <UserRow key={u.id} user={u} onDeactivate={handleDeactivate} />
                ))}
              </div>
            )}
          </div>

          {/* Admin users */}
          <div>
            <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Admins ({adminUsers.length})</div>
            <div className="space-y-2">
              {adminUsers.map(u => (
                <UserRow key={u.id} user={u} onDeactivate={handleDeactivate} />
              ))}
            </div>
          </div>

          {/* Kitchen Staff */}
          <div>
            <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Kitchen Staff ({kitchenUsers.length})</div>
            {kitchenUsers.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
                <ChefHat className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No kitchen staff yet.</p>
                <p className="text-white/20 text-xs mt-1">Kitchen staff log in at <span className="font-mono text-white/40">/kitchen</span> using phone + OTP</p>
                <button onClick={() => setShowAdd(true)} className="text-orange-400 text-sm font-bold mt-2 hover:underline">Add kitchen staff →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {kitchenUsers.map(u => (
                  <UserRow key={u.id} user={u} onDeactivate={handleDeactivate} />
                ))}
              </div>
            )}
          </div>

          {/* Riders */}
          <div>
            <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Riders ({riderUsers.length})</div>
            {riderUsers.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
                <Bike className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No riders yet.</p>
                <p className="text-white/20 text-xs mt-1">Riders log in via the Rider mobile app using phone + OTP</p>
                <button onClick={() => setShowAdd(true)} className="text-yellow-400 text-sm font-bold mt-2 hover:underline">Add rider →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {riderUsers.map(u => (
                  <UserRow key={u.id} user={u} onDeactivate={handleDeactivate} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <AddUserModal open={showAdd} onAdd={handleAdd} onClose={() => setShowAdd(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function UserRow({ user, onDeactivate }: { user: any; onDeactivate: (u: any) => void }) {
  const m = ROLE_META[user.role] || { label: user.role, color: "text-white/40", bg: "bg-white/5", icon: Users };
  const Icon = m.icon;
  return (
    <div className={`flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 ${!user.is_active ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${m.color}`} />
        </div>
        <div>
          <div className="font-bold text-white text-sm">{user.name}</div>
          <div className="text-xs text-white/30 font-mono">{user.phone}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${m.bg} ${m.color}`}>{m.label}</span>
        {!user.is_active ? (
          <span className="text-xs text-red-400 font-bold">Deactivated</span>
        ) : user.role !== "super_admin" ? (
          <button
            onClick={() => onDeactivate(user)}
            className="flex items-center gap-1 text-xs text-white/20 hover:text-red-400 transition-colors"
          >
            <UserX className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
