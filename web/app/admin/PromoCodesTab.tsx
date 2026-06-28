"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Ticket, X, ToggleLeft, ToggleRight, Tag, Shield, User } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const EMPTY_FORM = {
  code: "",
  discount_type: "percentage" as "percentage" | "flat" | "free_delivery",
  discount_percent: 10,
  discount_flat_paise: 0,
  max_discount_paise: 10000,
  min_order_paise: 0,
  is_active: true,
  first_order_only: false,
  new_user_only: false,
  per_user_limit: "" as string | number,
  description: "",
  expires_at: "",
  max_uses: "" as string | number,
};

function discountLabel(promo: any) {
  if (promo.discount_type === "free_delivery") return "Free Delivery";
  if (promo.discount_type === "flat") return `₹${((promo.discount_flat_paise || 0) / 100).toFixed(0)} off`;
  return `${promo.discount_percent}% off`;
}

function Inp({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

const cls = "w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500";

export function PromoCodesTab() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/promocodes/admin');
      setPromos(res.promoCodes || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromos(); }, []);

  useSocketRefresh(["promo_updated"], fetchPromos);

  const handleCreate = async () => {
    if (!form.code) return toast.error("Enter a code");
    try {
      await api.post('/promocodes/admin', {
        ...form,
        per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
      });
      toast.success("Promo code created — cache busted, live immediately");
      setIsCreating(false);
      setForm({ ...EMPTY_FORM });
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || "Failed to create");
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    setToggling(id);
    try {
      await api.patch(`/promocodes/admin/${id}`, { is_active: !current });
      toast.success(current ? "Disabled — users stop seeing it within 30s" : "Enabled — live in app");
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/promocodes/admin/${id}`);
      toast.success("Promo code deleted");
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
    setConfirmId(null);
  };

  if (loading) return <div className="p-8 text-center text-zinc-500 font-medium animate-pulse">Loading Promo Codes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Promo Codes</h2>
          <p className="text-zinc-400 text-sm font-medium">Disable = removed from app within 30 seconds.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-orange-500 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-orange-600 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Code
        </button>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="bg-[#11111a] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Create Promo Code</h3>
            <button onClick={() => setIsCreating(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Inp label="Code (e.g. DIWALI30)">
              <input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} className={cls} placeholder="DIWALI30"/>
            </Inp>

            <Inp label="Discount type">
              <select value={form.discount_type} onChange={e => f('discount_type', e.target.value)} className={cls}>
                <option value="percentage">Percentage %</option>
                <option value="flat">Flat ₹ amount</option>
                <option value="free_delivery">Free Delivery</option>
              </select>
            </Inp>

            {form.discount_type === "percentage" && (
              <Inp label="Discount %">
                <input type="number" value={form.discount_percent} onChange={e => f('discount_percent', Number(e.target.value))} className={cls} placeholder="20"/>
              </Inp>
            )}
            {form.discount_type === "flat" && (
              <Inp label="Flat discount (₹)">
                <input type="number" value={form.discount_flat_paise / 100} onChange={e => f('discount_flat_paise', Number(e.target.value) * 100)} className={cls} placeholder="30"/>
              </Inp>
            )}

            <Inp label="Max discount cap (₹, 0 = no cap)">
              <input type="number" value={form.max_discount_paise / 100} onChange={e => f('max_discount_paise', Number(e.target.value) * 100)} className={cls} placeholder="60"/>
            </Inp>
            <Inp label="Min order value (₹)">
              <input type="number" value={form.min_order_paise / 100} onChange={e => f('min_order_paise', Number(e.target.value) * 100)} className={cls} placeholder="100"/>
            </Inp>
            <Inp label="Max total uses (blank = unlimited)">
              <input type="number" value={form.max_uses} onChange={e => f('max_uses', e.target.value)} className={cls} placeholder="500"/>
            </Inp>
            <Inp label="Per-user limit (blank = unlimited)">
              <input type="number" value={form.per_user_limit} onChange={e => f('per_user_limit', e.target.value)} className={cls} placeholder="1"/>
            </Inp>
            <Inp label="Expiry (blank = no expiry)">
              <input type="datetime-local" value={form.expires_at} onChange={e => f('expires_at', e.target.value)} className={cls}/>
            </Inp>
            <Inp label="Description (shown to customer)">
              <input value={form.description} onChange={e => f('description', e.target.value)} className={cls} placeholder="Get 30% off this Diwali!"/>
            </Inp>
          </div>

          {/* Targeting toggles */}
          <div className="flex flex-wrap gap-3 pt-2">
            {[
              { key: 'first_order_only', label: 'First order only' },
              { key: 'new_user_only', label: 'New users only' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => f(key, !(form as any)[key])}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${(form as any)[key] ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-white/[0.04] border-white/10 text-zinc-500'}`}
              >
                <Shield size={12}/> {label}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleCreate} className="bg-orange-500 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-orange-600">
              Create Code
            </button>
          </div>
        </div>
      )}

      {/* Promo grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {promos.map(promo => (
          <div
            key={promo.id}
            className={`bg-[#11111a] border rounded-2xl p-5 transition-all group relative overflow-hidden ${
              promo.is_active ? 'border-orange-500/30 shadow-lg shadow-orange-500/5' : 'border-white/[0.05] opacity-50'
            }`}
          >
            {promo.is_active && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-orange-400" />}

            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-black text-2xl text-white tracking-tighter">{promo.code}</h3>
                <p className="text-orange-400 text-xs font-bold mt-0.5">{discountLabel(promo)}</p>
                {promo.description && <p className="text-zinc-500 text-xs mt-1">{promo.description}</p>}
              </div>
              <button
                onClick={() => setConfirmId(promo.id)}
                className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
              >
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>

            <div className="space-y-1.5 mb-4 text-xs">
              {promo.max_discount_paise > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Max discount</span><span className="text-white font-semibold">₹{promo.max_discount_paise / 100}</span>
                </div>
              )}
              {promo.min_order_paise > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Min order</span><span className="text-white font-semibold">₹{promo.min_order_paise / 100}</span>
                </div>
              )}
              {promo.per_user_limit && (
                <div className="flex justify-between text-zinc-500">
                  <span>Per-user limit</span><span className="text-white font-semibold">{promo.per_user_limit}x</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-500">
                <span>Uses</span><span className="text-white font-semibold">{promo.times_used || 0}{promo.max_uses ? ` / ${promo.max_uses}` : ''}</span>
              </div>
            </div>

            {/* Targeting badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {promo.first_order_only && (
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full">1st order only</span>
              )}
              {promo.new_user_only && (
                <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">New users</span>
              )}
            </div>

            {/* ON/OFF toggle */}
            <button
              onClick={() => handleToggle(promo.id, promo.is_active)}
              disabled={toggling === promo.id}
              className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                promo.is_active
                  ? 'bg-white/[0.04] text-zinc-400 hover:bg-red-500/10 hover:text-red-400'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
            >
              {promo.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
              {toggling === promo.id ? '...' : promo.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}

        {promos.length === 0 && (
          <div className="col-span-full py-20 text-center border border-white/10 border-dashed rounded-2xl">
            <Ticket className="w-10 h-10 text-zinc-700 mx-auto mb-3"/>
            <p className="text-zinc-600 font-bold text-xs uppercase tracking-widest">No promo codes yet</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmId}
        title="Delete Promo Code?"
        message="Customers will no longer be able to use it."
        confirmText="Delete"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
        isDanger
      />
    </div>
  );
}
