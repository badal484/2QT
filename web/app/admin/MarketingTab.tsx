"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit, X, Zap, Upload, ImageIcon, Video, Film, MapPin, Globe } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import Image from "next/image";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { SkeletonList } from "../components/ui/Skeleton";

const EMPTY_BANNER = {
  title: "", subtitle: "", tag_text: "", image_url: "", video_url: "",
  media_type: "IMAGE" as "IMAGE" | "VIDEO",
  action_type: "NONE", action_payload: "", display_order: 0,
  is_active: true, banner_type: "MAIN", slide_duration_ms: 3000,
  zone_id: null as string | null,
};

function sizeHint(type: string) {
  if (type === 'STRIP') return '1200 × 300 px';
  if (type === 'MINI')  return '400 × 400 px';
  return '1200 × 520 px';
}

function BannerForm({
  data,
  onChange,
  zones,
  onImageUpload,
  onImageRemove,
  uploadingImage,
  imageInputRef,
  onVideoUpload,
  onVideoRemove,
  uploadingVideo,
  videoInputRef,
  title,
  onClose,
  onSave,
  saveLabel,
}: {
  data: typeof EMPTY_BANNER;
  onChange: (d: typeof EMPTY_BANNER) => void;
  zones: Array<{ id: string; name: string }>;
  onImageUpload: (f: File) => void;
  onImageRemove: () => void;
  uploadingImage: boolean;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onVideoUpload: (f: File) => void;
  onVideoRemove: () => void;
  uploadingVideo: boolean;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  const inp = "w-full bg-white/[0.03] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-primary";

  // Local text buffer for the duration field
  const [durationText, setDurationText] = useState(String((data.slide_duration_ms ?? 3000) / 1000));
  useEffect(() => {
    setDurationText(String((data.slide_duration_ms ?? 3000) / 1000));
  }, [(data as any).id]);

  return (
    <div className="bg-[#11111a] border border-white/[0.05] rounded-3xl p-6 shadow-sm mb-8 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
      </div>

      {/* Media Type Toggle */}
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Banner Media Type</label>
        <div className="inline-flex p-1 bg-white/[0.04] border border-white/10 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => onChange({ ...data, media_type: "IMAGE" })}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              data.media_type === "IMAGE"
                ? "bg-brand-primary text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Static Image
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...data, media_type: "VIDEO" })}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              data.media_type === "VIDEO"
                ? "bg-brand-primary text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Film className="w-4 h-4" /> Looping Video
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Title</label>
          <input value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} className={inp} placeholder="Gourmet Meals" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Subtitle</label>
          <input value={data.subtitle} onChange={e => onChange({ ...data, subtitle: e.target.value })} className={inp} placeholder="Crafted for you" />
        </div>

        {/* Target Zone Selection */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> Target Delivery Zone</span>
            <span className="text-zinc-500 text-[10px] lowercase">hybrid scope</span>
          </label>
          <select
            value={data.zone_id || ""}
            onChange={e => onChange({ ...data, zone_id: e.target.value || null })}
            className={inp}
          >
            <option value="" className="text-black bg-zinc-900 text-white">🌐 All Zones (Global)</option>
            {zones.map(z => (
              <option key={z.id} value={z.id} className="text-black bg-zinc-900 text-white">📍 {z.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tag Pill Text</label>
          <input value={data.tag_text} onChange={e => onChange({ ...data, tag_text: e.target.value })} className={inp} placeholder="30 MIN" />
        </div>

        {/* Video Upload Section if VIDEO */}
        {data.media_type === "VIDEO" ? (
          <div className="col-span-1 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center justify-between">
              <span>Banner Video (MP4 / WebM)</span>
              <span className="text-brand-primary font-semibold lowercase">autoplay & loop</span>
            </label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onVideoUpload(f); e.target.value = ""; }}
            />
            {data.video_url ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-white/10 group bg-black">
                <video src={data.video_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button type="button" onClick={() => videoInputRef.current?.click()}
                    className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Upload className="w-3 h-3" /> Replace Video
                  </button>
                  <button type="button" onClick={onVideoRemove}
                    className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo}
                className="w-full h-36 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all disabled:opacity-50">
                {uploadingVideo
                  ? <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  : <><Video className="w-6 h-6 text-zinc-500" /><span className="text-xs font-semibold text-zinc-500">Click to upload MP4/WebM video</span></>
                }
              </button>
            )}
            <p className="mt-1.5 text-xs text-zinc-500">
              Recommended: <span className="font-semibold text-zinc-400">1200 × 520 px</span> · Under 30MB
            </p>
          </div>
        ) : (
          /* Image Upload Section if IMAGE */
          <div className="col-span-1 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Banner Image</label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(f); e.target.value = ""; }}
            />
            {data.image_url ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-white/10 group">
                <Image src={data.image_url} alt="Preview" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button type="button" onClick={() => imageInputRef.current?.click()}
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
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
                className="w-full h-36 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all disabled:opacity-50">
                {uploadingImage
                  ? <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  : <><ImageIcon className="w-6 h-6 text-zinc-500" /><span className="text-xs font-semibold text-zinc-500">Click to upload image</span></>
                }
              </button>
            )}
            <p className="mt-1.5 text-xs text-zinc-500">
              Recommended: <span className="font-semibold text-zinc-400">{sizeHint(data.banner_type)}</span> · JPEG or WebP
            </p>
          </div>
        )}

        {/* Poster Image upload if VIDEO */}
        {data.media_type === "VIDEO" && (
          <div className="col-span-1 md:col-span-2 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
              <span>Thumbnail / Poster Image <span className="text-zinc-500 font-normal lowercase">(optional — shown while video loads)</span></span>
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(f); e.target.value = ""; }}
            />
            {data.image_url ? (
              <div className="relative w-48 h-20 rounded-lg overflow-hidden border border-white/10 group mt-2">
                <Image src={data.image_url} alt="Poster preview" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded">Replace</button>
                  <button type="button" onClick={onImageRemove} className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">Remove</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
                className="mt-2 px-4 py-2 border border-dashed border-white/10 rounded-xl text-xs text-zinc-400 hover:text-white hover:border-brand-primary flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5" /> Upload Fallback Thumbnail Image
              </button>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Action Type</label>
          <select value={data.action_type} onChange={e => onChange({ ...data, action_type: e.target.value })} className={inp}>
            <option value="NONE" className="text-black bg-zinc-900 text-white">No Action</option>
            <option value="APPLY_COUPON" className="text-black bg-zinc-900 text-white">Apply Coupon</option>
            <option value="FILTER_CATEGORY" className="text-black bg-zinc-900 text-white">Filter Category</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Banner Type</label>
          <select value={data.banner_type} onChange={e => onChange({ ...data, banner_type: e.target.value })} className={inp}>
            <option value="MAIN" className="text-black bg-zinc-900 text-white">Main Banner (Large)</option>
            <option value="MINI" className="text-black bg-zinc-900 text-white">Mini Banner (Quick Filter)</option>
            <option value="STRIP" className="text-black bg-zinc-900 text-white">Strip Banner (Wide & Short)</option>
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
        <div className="col-span-1 md:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Auto-Slide Duration (seconds)</label>
          <input
            type="number"
            min={1}
            step={0.5}
            value={durationText}
            onChange={e => {
              const text = e.target.value;
              setDurationText(text);
              const num = parseFloat(text);
              if (!isNaN(num) && num > 0) onChange({ ...data, slide_duration_ms: Math.round(num * 1000) });
            }}
            onBlur={() => {
              const num = parseFloat(durationText);
              if (isNaN(num) || num <= 0) setDurationText(String((data.slide_duration_ms ?? 3000) / 1000));
            }}
            className={inp}
            placeholder="3"
          />
        </div>
      </div>
      <div className="pt-4 flex justify-end">
        <button onClick={onSave} className="bg-brand-primary text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-all">
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export function MarketingTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBanner, setNewBanner] = useState<typeof EMPTY_BANNER>({ ...EMPTY_BANNER });
  const [createImageUploading, setCreateImageUploading] = useState(false);
  const [createVideoUploading, setCreateVideoUploading] = useState(false);
  const createImageFileRef = useRef<HTMLInputElement>(null);
  const createVideoFileRef = useRef<HTMLInputElement>(null);

  const [editingBanner, setEditingBanner] = useState<(typeof EMPTY_BANNER & { id: string }) | null>(null);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editVideoUploading, setEditVideoUploading] = useState(false);
  const editImageFileRef = useRef<HTMLInputElement>(null);
  const editVideoFileRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  const fetchZones = async () => {
    try {
      const res = await api.get('/admin/zones');
      setZones(res.zones || []);
    } catch (e) {
      console.error("Failed to load zones", e);
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
    fetchZones();
    fetchBanners();
  }, []);

  useSocketRefresh(["promo_updated", "campaign_updated", "banner_updated"], fetchBanners);

  const makeImageUploader = (
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

  const makeVideoUploader = (
    setter: (fn: (b: any) => any) => void,
    setUploading: (v: boolean) => void
  ) => async (file: File) => {
    setUploading(true);
    try {
      const res = await api.uploadVideo(file);
      setter(b => ({ ...b, video_url: res.url, media_type: "VIDEO" }));
      toast.success("Video uploaded successfully");
    } catch (e: any) {
      toast.error(e.message || "Video upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (newBanner.media_type === "VIDEO" && !newBanner.video_url) {
        toast.error("Please upload a video file for this video banner");
        return;
      }
      if (newBanner.media_type === "IMAGE" && !newBanner.image_url) {
        toast.error("Please upload a banner image");
        return;
      }
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
      fetchBanners();
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle status");
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

  // Filter banners based on selected zone filter
  const filteredBanners = banners.filter(b => {
    if (selectedZoneFilter === "ALL") return true;
    if (selectedZoneFilter === "GLOBAL") return !b.zone_id;
    return b.zone_id === selectedZoneFilter;
  });

  if (loading) return <SkeletonList rows={6} />;

  return (
    <div className="p-8 space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Promotional Banners</h2>
          <p className="text-zinc-400 font-medium">Manage global & zone-specific image/video banners for the customer menu and mobile app.</p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditingBanner(null); }}
          className="bg-brand-primary text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:bg-brand-primary-dark transition-all shadow-lg flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> New Banner
        </button>
      </div>

      {/* Zone Filter Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/[0.06]">
        <button
          onClick={() => setSelectedZoneFilter("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedZoneFilter === "ALL"
              ? "bg-brand-primary text-white shadow-md"
              : "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
          }`}
        >
          <span>All Banners</span>
          <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full">{banners.length}</span>
        </button>
        <button
          onClick={() => setSelectedZoneFilter("GLOBAL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedZoneFilter === "GLOBAL"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Global Only</span>
          <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full">{banners.filter(b => !b.zone_id).length}</span>
        </button>
        {zones.map(z => {
          const count = banners.filter(b => b.zone_id === z.id).length;
          return (
            <button
              key={z.id}
              onClick={() => setSelectedZoneFilter(z.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedZoneFilter === z.id
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{z.name}</span>
              <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          );
        })}
      </div>

      {isCreating && (
        <BannerForm
          data={newBanner}
          onChange={setNewBanner}
          zones={zones}
          onImageUpload={makeImageUploader(setNewBanner as any, setCreateImageUploading)}
          onImageRemove={() => setNewBanner(b => ({ ...b, image_url: "" }))}
          uploadingImage={createImageUploading}
          imageInputRef={createImageFileRef}
          onVideoUpload={makeVideoUploader(setNewBanner as any, setCreateVideoUploading)}
          onVideoRemove={() => setNewBanner(b => ({ ...b, video_url: "" }))}
          uploadingVideo={createVideoUploading}
          videoInputRef={createVideoFileRef}
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
          zones={zones}
          onImageUpload={makeImageUploader(setEditingBanner as any, setEditImageUploading)}
          onImageRemove={() => setEditingBanner(eb => eb ? { ...eb, image_url: "" } : null)}
          uploadingImage={editImageUploading}
          imageInputRef={editImageFileRef}
          onVideoUpload={makeVideoUploader(setEditingBanner as any, setEditVideoUploading)}
          onVideoRemove={() => setEditingBanner(eb => eb ? { ...eb, video_url: "" } : null)}
          uploadingVideo={editVideoUploading}
          videoInputRef={editVideoFileRef}
          title={`Edit Banner — ${editingBanner.title}`}
          onClose={() => setEditingBanner(null)}
          onSave={handleUpdate}
          saveLabel="Update Banner"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBanners.map(banner => {
          const isVideo = banner.media_type === "VIDEO" && banner.video_url;
          const zoneName = banner.zone_name || zones.find(z => z.id === banner.zone_id)?.name;
          return (
            <div key={banner.id} className={`bg-[#11111a] border ${banner.is_active ? 'border-brand-primary/30 shadow-lg' : 'border-white/[0.05] opacity-60'} rounded-3xl overflow-hidden transition-all group flex flex-col`}>
              <div className="relative h-36 bg-black overflow-hidden">
                {isVideo ? (
                  <video
                    src={banner.video_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={banner.image_url}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                  />
                ) : banner.image_url ? (
                  <Image src={banner.image_url} alt={banner.title} fill className="object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">No Media</div>
                )}
                
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 max-w-[70%]">
                  {banner.tag_text && (
                    <div className="inline-flex items-center gap-1 bg-brand-primary text-[10px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow">
                      <Zap className="w-3 h-3" /> {banner.tag_text}
                    </div>
                  )}
                  {isVideo && (
                    <div className="inline-flex items-center gap-1 bg-purple-600/90 text-[10px] font-black uppercase tracking-wider text-white px-2 py-0.5 rounded shadow backdrop-blur">
                      <Film className="w-3 h-3" /> VIDEO
                    </div>
                  )}
                  {banner.zone_id ? (
                    <div className="inline-flex items-center gap-1 bg-emerald-600/90 text-[10px] font-black uppercase tracking-wider text-white px-2 py-0.5 rounded shadow backdrop-blur">
                      <MapPin className="w-3 h-3" /> {zoneName || "Zone"}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 bg-blue-600/80 text-[10px] font-black uppercase tracking-wider text-white px-2 py-0.5 rounded shadow backdrop-blur">
                      <Globe className="w-3 h-3" /> ALL ZONES
                    </div>
                  )}
                </div>

                <div className="absolute top-3 right-3 flex gap-2 z-10">
                  <button
                    onClick={() => handleToggleActive(banner.id, banner.is_active)}
                    className="bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full shadow-sm hover:scale-105"
                  >
                    {banner.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingBanner({
                        ...banner,
                        media_type: banner.media_type || (banner.video_url ? 'VIDEO' : 'IMAGE'),
                        slide_duration_ms: banner.slide_duration_ms ?? 3000,
                        zone_id: banner.zone_id || null,
                      });
                      setIsCreating(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
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
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg leading-tight text-white mb-1">{banner.title}</h3>
                  <p className="text-sm text-zinc-400 font-medium line-clamp-1 mb-4">{banner.subtitle}</p>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <div className="text-xs font-bold uppercase text-zinc-500">
                    {banner.banner_type === 'MINI' ? 'Type: MINI' : banner.banner_type === 'STRIP' ? 'Type: STRIP' : 'Type: MAIN'} | Order: {banner.display_order} | {((banner.slide_duration_ms ?? 3000) / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs font-bold bg-white/5 px-2 py-1 rounded text-zinc-400">
                    {banner.action_type} {banner.action_payload && `(${banner.action_payload})`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredBanners.length === 0 && (
          <div className="col-span-full py-20 text-center text-zinc-500 font-medium">
            No banners found for {selectedZoneFilter === "ALL" ? "all zones" : selectedZoneFilter === "GLOBAL" ? "global scope" : "this zone"}. Create one above.
          </div>
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
