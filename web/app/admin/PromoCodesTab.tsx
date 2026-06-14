"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Tag, Ticket, X } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";

export function PromoCodesTab() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPromo, setNewPromo] = useState({
    code: "",
    discount_percent: 10,
    max_discount_paise: 10000,
    min_order_paise: 0,
    is_active: true
  });
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

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

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post('/promocodes/admin', newPromo);
      toast.success("Promo code created!");
      setIsCreating(false);
      setNewPromo({
        code: "", discount_percent: 10, max_discount_paise: 10000, min_order_paise: 0, is_active: true
      });
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || "Failed to create");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/promocodes/admin/${id}`, { is_active: !currentStatus });
      toast.success("Status updated");
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await api.delete(`/promocodes/admin/${id}`);
      toast.success("Promo code deleted");
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  if (loading) return <div className="p-8 text-center text-zinc-500 font-medium animate-pulse">Loading Promo Codes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Promo Codes</h2>
          <p className="text-zinc-400 text-sm font-medium">Manage active discount codes and coupons.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-brand-primary text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-brand-primary-dark transition-all shadow-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Code
        </button>
      </div>

      {isCreating && (
        <div className="bg-[#11111a] border border-white/[0.05] rounded-[24px] p-6 shadow-2xl mb-8 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Create New Promo Code</h3>
            <button onClick={() => setIsCreating(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Code (e.g. SUMMER20)</label>
              <input value={newPromo.code} onChange={e=>setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary" placeholder="SUMMER20" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Discount %</label>
              <input type="number" value={newPromo.discount_percent} onChange={e=>setNewPromo({...newPromo, discount_percent: parseInt(e.target.value) || 0})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary" placeholder="10" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Max Discount (₹)</label>
              <input type="number" value={newPromo.max_discount_paise / 100} onChange={e=>setNewPromo({...newPromo, max_discount_paise: (parseInt(e.target.value) || 0) * 100})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary" placeholder="100" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Min Order Value (₹)</label>
              <input type="number" value={newPromo.min_order_paise / 100} onChange={e=>setNewPromo({...newPromo, min_order_paise: (parseInt(e.target.value) || 0) * 100})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-primary" placeholder="299" />
            </div>
          </div>
          <div className="pt-4 flex justify-end">
             <button onClick={handleCreate} className="bg-brand-primary text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-brand-primary-dark">Save Code</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promos.map(promo => (
          <div key={promo.id} className={`bg-[#11111a] border ${promo.is_active ? 'border-brand-primary/30 shadow-lg' : 'border-white/[0.05] opacity-60'} rounded-[24px] p-6 transition-all group relative overflow-hidden`}>
            {promo.is_active && <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-brand-primary">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-2xl text-white tracking-tighter">{promo.code}</h3>
                  <div className="text-[10px] font-bold text-swish-green uppercase tracking-widest">{promo.discount_percent}% OFF</div>
                </div>
              </div>
              <button onClick={() => handleDelete(promo.id)} className="text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-500">Max Discount</span>
                <span className="text-white">₹{promo.max_discount_paise / 100}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-500">Min Order</span>
                <span className="text-white">₹{promo.min_order_paise / 100}</span>
              </div>
            </div>

            <button 
              onClick={() => handleToggleActive(promo.id, promo.is_active)} 
              className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${promo.is_active ? 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]' : 'bg-swish-green/10 text-swish-green hover:bg-swish-green/20'}`}
            >
              {promo.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
        {promos.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white/[0.02] border border-white/10 border-dashed rounded-[40px]">
            <Ticket className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">No promo codes found</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Delete Promo Code?"
        message="Are you sure you want to delete this promo code? Customers will no longer be able to use it."
        confirmText="Delete Code"
        onConfirm={() => {
          if (confirmDialog.id) executeDelete(confirmDialog.id);
          setConfirmDialog({ isOpen: false, id: null });
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, id: null })}
        isDanger={true}
      />
    </div>
  );
}
