"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit, X, Zap, Upload, ImageIcon } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import Image from "next/image";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const EMPTY_BANNER = {
  title: "", subtitle: "", tag_text: "", image_url: "",
  action_type: "NONE", action_payload: "", display_order: 0,
  is_active: true, banner_type: "MAIN",
};

function sizeHint(type: string) {
  if (type === 'STRIP') return '1200 × 300 px';
  if (type === 'MINI')  return '400 × 400 px';
  return '1200 × 520 px';
}

function BannerForm({
  data,
  onChange,
  onImageUpload,
  onImageRemove,
  uploading,
  fileInputRef,
  title,
  onClose,
  onSave,
  saveLabel,
}: {
  data: typeof EMPTY_BANNER;
  onChange: (d: typeof EMPTY_BANNER) => void;
  onImageUpload: (f: File) => void;
  onImageRemove: () => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  const inp = "w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary";
  return (
    <div className="bg-[#11111a] border border-white/[0.05] rounded-3xl p-6 shadow-sm mb-8 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Title</label>
          <input value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} className={inp} placeholder="Gourmet Meals" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Subtitle</label>
          <input value={data.subtitle} onChange={e => onChange({ ...data, subtitle: e.target.value })} className={inp} placeholder="Crafted for you" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tag Pill Text</label>
          <input value={data.tag_text} onChange={e => onChange({ ...data, tag_text: e.target.value })} className={inp} placeholder="30 MIN" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Banner Image</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(f); e.target.value = ""; }}
          />
          {data.image_url ? (
            <div className="relative w-full h-28 rounded-xl overflow-hidden border border-white/10 group">
              <Image src={data.image_url} alt="Preview" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Upload className="w-3 h-3" /> Replace
                </button>
                <button type="button" onClick={onImageRemove}
                  className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full h-28 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all disabled:opacity-50">
              {uploading
                ? <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                : <><ImageIcon className="w-6 h-6 text-zinc-500" /><span className="text-xs font-semibold text-zinc-500">Click to upload image</span></>
              }
            </button>
          )}
          <p className="mt-1.5 text-xs text-zinc-500">
            Recommended: <span className="font-semibold text-zinc-400">{sizeHint(data.banner_type)}</span> · JPEG or WebP
          </p>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Action Type</label>
          <select value={data.action_type} onChange={e => onChange({ ...data, action_type: e.target.value })} className={inp}>
            <option value="NONE" className="text-black">No Action</option>
            <option value="APPLY_COUPON" className="text-black">Apply Coupon</option>
            <option value="FILTER_CATEGORY" className="text-black">Filter Category</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Banner Type</label>
          <select value={data.banner_type} onChange={e => onChange({ ...data, banner_type: e.target.value })} className={inp}>
            <option value="MAIN" className="text-black">Main Banner (Large)</option>
            <option value="MINI" className="text-black">Mini Banner (Quick Filter)</option>
            <option value="STRIP" className="text-black">Strip Banner (Wide & Short)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Action Payload</label>
          <input value={data.action_payload} onChange={e => onChange({ ...data, action_payload: e.target.value })} className={inp} placeholder="e.g. FIRST50 or Pizza" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Display Order</label>
          <input type="number" value={data.display_order} onChange={e => onChange({ ...data, display_order: Number(e.target.value) })} className={inp} placeholder="0" />
        </div>
      </div>
      <div className="pt-4 flex justify-end">
        <button onClick={onSave} className="bg-brand-primary text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-primary-dark">
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export function MarketingTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBanner, setNewBanner] = useState<typeof EMPTY_BANNER>({ ...EMPTY_BANNER });
  const [createUploading, setCreateUploading] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);

  const [editingBanner, setEditingBanner] = useState<(typeof EMPTY_BANNER & { id: string }) | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

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

  useEffect(() => { fetchBanners(); }, []);

  useSocketRefresh(["promo_updated", "campaign_updated"], fetchBanners);

  const makeUploader = (
    setter: (fn: (b: any) => any) => void,
    setUploading: (v: boolean) => void
  ) => async (file: File) => {
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setter(b => ({ ...b, image_url: res.url }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/banners/admin', newBanner);
      toast.success("Banner created!");
      setIsCreating(false);
      setNewBanner({ ...EMPTY_BANNER });
      fetchBanners();
    } catch (e: any) {
      toast.error(e.message || "Failed to create");
    }
  };

  const handleUpdate = async () => {
    if (!editingBanner) return;
    try {
      const { id, ...fields } = editingBanner;
      await api.patch(`/banners/admin/${id}`, fields);
      toast.success("Banner updated!");
      setEditingBanner(null);
      fetchBanners();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
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

  if (loading) return <div className="p-8 text-center text-zinc-500 font-medium animate-pulse">Loading Banners...</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Promotional Banners</h2>
          <p className="text-zinc-400 font-medium">Manage the auto-playing marketing carousel on the customer menu page.</p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditingBanner(null); }}
          className="bg-brand-primary text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:bg-brand-primary-dark transition-all shadow-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Banner
        </button>
      </div>

      {isCreating && (
        <BannerForm
          data={newBanner}
          onChange={setNewBanner}
          onImageUpload={makeUploader(setNewBanner as any, setCreateUploading)}
          onImageRemove={() => setNewBanner(b => ({ ...b, image_url: "" }))}
          uploading={createUploading}
          fileInputRef={createFileRef}
          title="Create New Banner"
          onClose={() => setIsCreating(false)}
          onSave={handleCreate}
          saveLabel="Save Banner"
        />
      )}

      {editingBanner && (
        <BannerForm
          data={editingBanner}
          onChange={d => setEditingBanner(eb => eb ? { ...d, id: eb.id } : null)}
          onImageUpload={makeUploader(setEditingBanner as any, setEditUploading)}
          onImageRemove={() => setEditingBanner(eb => eb ? { ...eb, image_url: "" } : null)}
          uploading={editUploading}
          fileInputRef={editFileRef}
          title={`Edit Banner — ${editingBanner.title}`}
          onClose={() => setEditingBanner(null)}
          onSave={handleUpdate}
          saveLabel="Update Banner"
        />
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
                <button
                  onClick={() => handleToggleActive(banner.id, banner.is_active)}
                  className="bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full shadow-sm hover:scale-105"
                >
                  {banner.is_active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => { setEditingBanner({ ...banner }); setIsCreating(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="bg-zinc-800/90 text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setConfirmDialog({ isOpen: true, id: banner.id })}
                  className="bg-red-500/90 text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
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
