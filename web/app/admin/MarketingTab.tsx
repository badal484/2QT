"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit, Save, X, Zap, Upload, ImageIcon } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import Image from "next/image";
import { ConfirmModal } from "../../components/ConfirmModal";

export function MarketingTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBanner, setNewBanner] = useState({
    title: "",
    subtitle: "",
    tag_text: "",
    image_url: "",
    action_type: "NONE",
    action_payload: "",
    display_order: 0,
    is_active: true,
    banner_type: "MAIN"
  });
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setNewBanner(b => ({ ...b, image_url: res.url }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get('/banners/admin');
      setBanners(res.banners || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post('/banners/admin', newBanner);
      toast.success("Banner created!");
      setIsCreating(false);
      setNewBanner({
        title: "", subtitle: "", tag_text: "", image_url: "",
        action_type: "NONE", action_payload: "", display_order: 0, is_active: true, banner_type: "MAIN"
      });
      fetchBanners();
    } catch (e: any) {
      toast.error(e.message || "Failed to create");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/banners/admin/${id}`, { is_active: !currentStatus });
      toast.success("Status updated");
      fetchBanners();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await api.delete(`/banners/admin/${id}`);
      toast.success("Banner deleted");
      fetchBanners();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  if (loading) return <div className="p-8 text-center text-zinc-500 font-medium animate-pulse">Loading Banners...</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Promotional Banners</h2>
          <p className="text-zinc-400 font-medium">Manage the auto-playing marketing carousel on the customer menu page.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-brand-primary text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:bg-brand-primary-dark transition-all shadow-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Banner
        </button>
      </div>

      {isCreating && (
        <div className="bg-[#11111a] border border-white/[0.05] rounded-3xl p-6 shadow-sm mb-8 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Create New Banner</h3>
            <button onClick={() => setIsCreating(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Title</label>
              <input value={newBanner.title} onChange={e=>setNewBanner({...newBanner, title: e.target.value})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary" placeholder="Gourmet Meals" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Subtitle</label>
              <input value={newBanner.subtitle} onChange={e=>setNewBanner({...newBanner, subtitle: e.target.value})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary" placeholder="Crafted for you" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tag Pill Text</label>
              <input value={newBanner.tag_text} onChange={e=>setNewBanner({...newBanner, tag_text: e.target.value})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary" placeholder="30 MIN" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Banner Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
              />
              {newBanner.image_url ? (
                <div className="relative w-full h-28 rounded-xl overflow-hidden border border-white/10 group">
                  <Image src={newBanner.image_url} alt="Preview" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                      <Upload className="w-3 h-3" /> Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBanner(b => ({ ...b, image_url: "" }))}
                      className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-28 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-zinc-500" />
                      <span className="text-xs font-semibold text-zinc-500">Click to upload image</span>
                    </>
                  )}
                </button>
              )}
              <p className="mt-1.5 text-xs text-zinc-500">
                Recommended:&nbsp;
                <span className="font-semibold text-zinc-400">
                  {newBanner.banner_type === 'STRIP' ? '1200 × 300 px' : newBanner.banner_type === 'MINI' ? '400 × 400 px' : '1200 × 520 px'}
                </span>
                &nbsp;· JPEG or WebP
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Action Type</label>
              <select value={newBanner.action_type} onChange={e=>setNewBanner({...newBanner, action_type: e.target.value})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary">
                <option value="NONE" className="text-black">No Action</option>
                <option value="APPLY_COUPON" className="text-black">Apply Coupon</option>
                <option value="FILTER_CATEGORY" className="text-black">Filter Category</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Banner Type</label>
              <select value={newBanner.banner_type} onChange={e=>setNewBanner({...newBanner, banner_type: e.target.value})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary">
                <option value="MAIN" className="text-black">Main Banner (Large)</option>
                <option value="MINI" className="text-black">Mini Banner (Quick Filter)</option>
                <option value="STRIP" className="text-black">Strip Banner (Wide & Short)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Action Payload</label>
              <input value={newBanner.action_payload} onChange={e=>setNewBanner({...newBanner, action_payload: e.target.value})} className="w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary" placeholder="e.g. FIRST50 or Pizza" />
            </div>
          </div>
          <div className="pt-4 flex justify-end">
             <button onClick={handleCreate} className="bg-brand-primary text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-primary-dark">Save Banner</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map(banner => (
          <div key={banner.id} className={`bg-[#11111a] border ${banner.is_active ? 'border-brand-primary/30 shadow-lg' : 'border-white/[0.05] opacity-60'} rounded-3xl overflow-hidden transition-all group`}>
            <div className="relative h-32 bg-black">
               <Image src={banner.image_url} alt={banner.title} fill className="object-cover opacity-60" />
               <div className="absolute top-4 left-4 inline-flex items-center gap-1 bg-brand-primary text-[10px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow">
                  <Zap className="w-3 h-3" /> {banner.tag_text}
               </div>
               <div className="absolute top-4 right-4 flex gap-2">
                 <button onClick={() => handleToggleActive(banner.id, banner.is_active)} className="bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full shadow-sm hover:scale-105">
                   {banner.is_active ? 'Active' : 'Paused'}
                 </button>
                 <button onClick={() => handleDelete(banner.id)} className="bg-red-500/90 text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                   <Trash2 className="w-3 h-3" />
                 </button>
               </div>
            </div>
            <div className="p-5">
               <h3 className="font-bold text-lg leading-tight text-white mb-1">{banner.title}</h3>
               <p className="text-sm text-zinc-400 font-medium line-clamp-1 mb-4">{banner.subtitle}</p>
               <div className="flex items-center justify-between border-t border-white/10 pt-4">
                 <div className="text-xs font-bold uppercase text-zinc-500">
                   {banner.banner_type === 'MINI' ? 'Type: MINI' : banner.banner_type === 'STRIP' ? 'Type: STRIP' : 'Type: MAIN'} | Order: {banner.display_order}
                 </div>
                 <div className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-zinc-400">
                   {banner.action_type} {banner.action_payload && `(${banner.action_payload})`}
                 </div>
               </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <div className="col-span-full py-20 text-center text-zinc-500 font-medium">No banners found. Create one above.</div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Delete Banner?"
        message="Are you sure you want to delete this promotional banner? This action cannot be undone."
        confirmText="Delete Banner"
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
