"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Utensils, Plus, CheckCircle2, Camera, Edit3, XCircle, ImagePlus, Video, Film, Trash2, Star, Sparkles, UploadCloud, MapPin } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { SkeletonList } from "../components/ui/Skeleton";
import { useAdminZone } from "./AdminZoneContext";

export function MenuTab() {
  const { selectedZoneId, setSelectedZoneId } = useAdminZone();
  const [items, setItems] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Synchronize with global zone selection
  useEffect(() => {
    if (selectedZoneId === "ALL") {
      setSelectedZone("All");
    } else if (selectedZoneId) {
      setSelectedZone(selectedZoneId);
    }
  }, [selectedZoneId]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingOptionImage, setUploadingOptionImage] = useState<{gIdx: number, oIdx: number} | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });
  const [modalZoneId, setModalZoneId] = useState<string>("");
  const [modalCategories, setModalCategories] = useState<string[]>([]);
  const [customizationGroups, setCustomizationGroups] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (showAddModal) {
      setImageUrl(editingItem?.photo_url || "");
      setVideoUrl(editingItem?.video_url || "");
      setGalleryImages(Array.isArray(editingItem?.images) ? editingItem.images : []);
      const zoneId = editingItem?.zone_id || (selectedZone !== "All" ? selectedZone : zones[0]?.id || "");
      setModalZoneId(zoneId);
      setCustomizationGroups(editingItem?.customization_groups || []);
    }
  }, [showAddModal, editingItem]);

  // Fetch categories from CategoriesTab whenever the modal zone changes
  const FALLBACK_CATEGORIES = ["Starters","Main Course","Breads","Rice & Biryani","Curries","Soups","Salads","Pasta","Burgers","Sandwiches","Pizza","Desserts","Beverages","Snacks","Healthy Bowls","Combos"];
  useEffect(() => {
    if (!modalZoneId) return;
    api.get(`/categories/admin?zoneId=${modalZoneId}`)
      .then((res) => {
        const cats: string[] = (res?.categories ?? []).map((c: any) => c.slug);
        setModalCategories(cats.length > 0 ? cats : FALLBACK_CATEGORIES);
      })
      .catch(() => setModalCategories(FALLBACK_CATEGORIES));
  }, [modalZoneId]);

  const load = async () => {
    try {
      const [menuRes, zonesRes] = await Promise.all([
        api.get("/admin/menu"),
        api.get("/admin/zones")
      ]);
      setItems(menuRes.items ?? []);
      setZones(zonesRes.zones ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useSocketRefresh(["menu_updated"], load);

  const toggle = async (id: string, current: boolean) => {
    setToggling(id);
    try {
      await api.patch(`/admin/menu/${id}/availability`, { available: !current });
      setItems(prev => prev.map(i => i.id === id ? { ...i, available: !current } : i));
    } finally {
      setToggling(null);
    }
  };

  const bulkToggle = async (enable: boolean) => {
    const toChange = [...selected].filter(id => {
      const item = items.find(i => i.id === id);
      return item && item.available !== enable;
    });
    await Promise.all(toChange.map(id =>
      api.patch(`/admin/menu/${id}/availability`, { available: enable })
    ));
    setItems(prev => prev.map(i => selected.has(i.id) ? { ...i, available: enable } : i));
    toast.success(`${enable ? "Enabled" : "Disabled"} ${selected.size} items`);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const allCategories = ["All", ...Array.from(new Set(items.map(i => i.category)))];

  const filtered = useMemo(() => items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || i.category === activeCategory;
    const matchZone = selectedZone === "All" || i.zone_id === selectedZone;
    return matchSearch && matchCat && matchZone;
  }), [items, search, activeCategory, selectedZone]);

  const liveCount = filtered.filter(i => i.available).length;
  const offCount = filtered.filter(i => !i.available).length;

  const renderGrid = useMemo(() => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {filtered.map(item => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`group relative rounded-[24px] overflow-hidden cursor-pointer border transition-all shadow-2xl shadow-black/40 ${
            selected.has(item.id) ? "border-swish-green/60 ring-1 ring-swish-green/30" : "border-white/10 hover:border-white/20"
          } ${!item.available ? "opacity-60" : ""}`}
          onClick={() => toggleSelect(item.id)}
        >
          {/* Photo */}
          <div className="relative aspect-[4/3] bg-zinc-900">
            {item.video_url && (
              <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full bg-purple-600/90 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg backdrop-blur-sm">
                <Video className="w-2.5 h-2.5" /> Video
              </div>
            )}
            {Array.isArray(item.images) && item.images.length > 0 && (
              <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg backdrop-blur-sm border border-white/10">
                +{item.images.length} photos
              </div>
            )}
            {item.photo_url ? (
              <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                <Camera className="w-8 h-8 text-zinc-700" />
              </div>
            )}
            {!item.available && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-black/60 px-3 py-1.5 rounded-full">Off Menu</span>
              </div>
            )}
            {/* Checkbox */}
            <div className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
              selected.has(item.id) ? "bg-swish-green border-swish-green" : "border-white/40 bg-black/40 opacity-0 group-hover:opacity-100"
            }`}>
              {selected.has(item.id) && <CheckCircle2 className="w-3 h-3 text-black" />}
            </div>
            {/* Veg/Egg badge */}
            <div className="absolute top-2.5 right-2.5">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${item.is_egg ? "border-yellow-500 bg-yellow-500/20" : item.is_veg ? "border-green-500 bg-green-500/20" : "border-red-500 bg-red-500/20"}`}>
                <div className={`w-2 h-2 rounded-full ${item.is_egg ? "bg-yellow-500" : item.is_veg ? "bg-green-500" : "bg-red-500"}`} />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="p-3.5 bg-zinc-900/90 backdrop-blur-xl">
            <h3 className="font-black text-sm text-white line-clamp-1 mb-0.5">{item.name}</h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-swish-green font-black text-sm">₹{(item.price_paise / 100).toLocaleString("en-IN")}</span>
              <div className="flex items-center gap-1.5 ml-2">
                {selectedZone === "All" && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-brand-primary truncate">{item.zone_name}</span>
                )}
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 truncate">{item.category}</span>
              </div>
            </div>
            {/* Hover Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setEditingItem(item); setShowAddModal(true); }}
                className="flex-1 py-1.5 rounded-xl bg-white/[0.06] text-[9px] font-black uppercase tracking-widest hover:bg-zinc-700/80 text-white transition-all flex items-center justify-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => toggle(item.id, item.available)}
                disabled={toggling === item.id}
                className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
                  item.available
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                    : "bg-swish-green/15 text-swish-green hover:bg-swish-green hover:text-black"
                }`}
              >
                {item.available ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  ), [filtered, selected, toggling, selectedZone]);

  const renderTable = useMemo(() => (
    <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[28px] overflow-hidden">
      <div className="grid grid-cols-[32px_1fr_130px_100px_80px_130px] gap-4 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
        <div />
        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Item</div>
        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Category</div>
        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Price</div>
        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Status</div>
        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-right">Actions</div>
      </div>
      {filtered.map(item => (
        <div
          key={item.id}
          className={`grid grid-cols-[32px_1fr_130px_100px_80px_130px] gap-4 px-6 py-4 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors group ${selected.has(item.id) ? "bg-swish-green/5" : ""}`}
        >
          <button
            onClick={() => toggleSelect(item.id)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selected.has(item.id) ? "bg-swish-green border-swish-green" : "border-white/20 hover:border-white/40"
            }`}
          >
            {selected.has(item.id) && <CheckCircle2 className="w-3 h-3 text-black" />}
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
              {item.photo_url
                ? <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full flex items-center justify-center"><Camera className="w-4 h-4 text-zinc-600" /></div>
              }
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm text-white truncate">{item.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${item.is_egg ? "bg-yellow-500" : item.is_veg ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-[9px] text-zinc-500 font-bold">{item.is_egg ? "Egg" : item.is_veg ? "Veg" : "Non-Veg"} · {item.station}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-zinc-400 truncate">{item.category}</span>
            {selectedZone === "All" && (
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary truncate">{item.zone_name}</span>
            )}
          </div>
          <span className="text-sm font-black text-swish-green">₹{(item.price_paise / 100).toLocaleString("en-IN")}</span>
          <span className={`text-[9px] font-black uppercase tracking-widest ${item.available ? "text-swish-green" : "text-red-400"}`}>
            {item.available ? "Live" : "Off"}
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setEditingItem(item); setShowAddModal(true); }}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-[9px] font-black uppercase tracking-widest hover:bg-zinc-700/80 text-white transition-all"
            >Edit</button>
            <button
              onClick={() => toggle(item.id, item.available)}
              disabled={toggling === item.id}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
                item.available
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                  : "bg-swish-green/15 text-swish-green hover:bg-swish-green hover:text-black"
              }`}
            >{item.available ? "Disable" : "Enable"}</button>
          </div>
        </div>
      ))}
    </div>
  ), [filtered, selected, toggling, selectedZone]);

  const renderContent = () => {
    if (loading) {
      return <SkeletonList rows={6} />;
    }
    if (filtered.length === 0) {
      return (
        <div className="py-24 text-center border border-white/10 border-dashed rounded-[32px]">
          <Utensils className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 font-bold text-sm">No items found</p>
        </div>
      );
    }
    return viewMode === "grid" ? renderGrid : renderTable;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Menu Items</h2>
          <p className="text-sm font-medium text-zinc-400">
            <span className="text-swish-green font-bold">{liveCount} live</span>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="text-red-400 font-bold">{offCount} off</span>
            <span className="mx-2 text-zinc-600">·</span>
            {filtered.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Zone Selector */}
          <select 
            value={selectedZone} 
            onChange={(e) => {
              const val = e.target.value;
              setSelectedZone(val);
              setSelectedZoneId(val === "All" ? "ALL" : val);
            }}
            className="px-4 py-2.5 rounded-xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 text-sm font-bold text-white focus:outline-none focus:ring-2 ring-swish-green/20 appearance-none min-w-[160px]"
          >
            <option value="All" className="bg-zinc-900">🌐 All Zones</option>
            {zones.map(z => <option key={z.id} value={z.id} className="bg-zinc-900">📍 {z.name}</option>)}
          </select>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 text-sm font-bold focus:outline-none focus:ring-2 ring-swish-green/20 w-52 text-white"
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >Grid</button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "table" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >Table</button>
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="px-5 py-2.5 rounded-xl bg-swish-green/15 text-swish-green text-[10px] font-black uppercase tracking-widest hover:bg-swish-green hover:text-black transition-all shadow-lg shadow-swish-green/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 ${
              activeCategory === cat
                ? "bg-swish-green text-black shadow-lg shadow-swish-green/30"
                : "bg-white/[0.03] border border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
            }`}
          >
            {cat}
            {cat !== "All" && <span className="ml-1.5 opacity-60">{items.filter(i => i.category === cat).length}</span>}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex items-center gap-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3"
          >
            <span className="text-sm font-black text-white">{selected.size} selected</span>
            <button onClick={() => bulkToggle(true)} className="px-4 py-1.5 rounded-xl bg-swish-green/15 text-swish-green text-[9px] font-black uppercase tracking-widest hover:bg-swish-green hover:text-black transition-all">Enable All</button>
            <button onClick={() => bulkToggle(false)} className="px-4 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Disable All</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-zinc-500 hover:text-white text-[9px] font-black uppercase tracking-widest">Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {renderContent()}


      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-white/10 rounded-[40px] w-full max-w-lg shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-white">{editingItem ? "Edit Item" : "New Menu Item"}</h3>
                    <p className="text-zinc-500 text-xs mt-1">{editingItem ? `Editing: ${editingItem.name}` : "All fields required to publish"}</p>
                  </div>
                  <button onClick={() => { setShowAddModal(false); setEditingItem(null); }} className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-all">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!imageUrl) {
                      toast.error("A dish photo is required. Please upload one.");
                      return;
                    }
                    const formData = new FormData(e.currentTarget);
                    const rawTags = (formData.get("tags") as string || "").split(",").map(t => t.trim()).filter(Boolean);
                    const data = {
                      name: formData.get("name"),
                      zone_id: formData.get("zone_id"),
                      description: formData.get("description"),
                      category: formData.get("category"),
                      price_paise: Math.round(parseFloat(formData.get("price") as string) * 100),
                      station: formData.get("station"),
                      photo_url: imageUrl,
                      images: galleryImages,
                      video_url: videoUrl || null,
                      is_veg: formData.get("dietary_type") === "veg",
                      is_egg: formData.get("dietary_type") === "egg",
                      is_bestseller: formData.get("is_bestseller") === "on",
                      is_new: formData.get("is_new") === "on",
                      tags: rawTags,
                      customization_groups: customizationGroups,
                      available: true
                    };
                    try {
                      setIsSaving(true);
                      if (editingItem) {
                        await api.put(`/admin/menu/${editingItem.id}`, data);
                      } else {
                        await api.post("/admin/menu", data);
                      }
                      setShowAddModal(false);
                      setEditingItem(null);
                      load();
                      toast.success(editingItem ? "Item updated!" : "Item published to menu!");
                    } catch (err: any) {
                      toast.error(`Failed to save: ${err.message || 'Unknown error'}`);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="space-y-6"
                >
                  {/* Image upload */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 block">
                      Primary Cover Photo <span className="text-red-400">*</span>
                    </label>
                    {imageUrl ? (
                      <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-white/10 group">
                        <img src={imageUrl} className="w-full h-full object-cover" alt="Preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <button type="button" onClick={() => setImageUrl("")} className="px-4 py-2 rounded-xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest">
                            Remove Photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className={`w-full h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${uploadingImage ? "border-swish-green/50 bg-swish-green/5" : "border-white/10 hover:border-swish-green/30 hover:bg-swish-green/5 bg-white/[0.02]"}`}>
                        {uploadingImage ? (
                          <>
                            <div className="w-8 h-8 rounded-full border-2 border-swish-green border-t-transparent animate-spin mb-3" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-swish-green">Uploading to ImageKit…</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-8 h-8 text-zinc-500 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Click to upload primary photo</span>
                            <span className="text-[9px] text-zinc-500 mt-1">Best: <strong>16:9 Landscape (1920 × 1080 px)</strong> · Max 10MB</span>
                          </>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                          if (!e.target.files?.[0]) return;
                          setUploadingImage(true);
                          try {
                            const res = await api.uploadImage(e.target.files[0]);
                            if (res?.url) setImageUrl(res.url);
                            else throw new Error("No URL returned from server");
                          } catch (err: any) {
                            console.error("Image upload error:", err);
                            toast.error(`Upload error: ${err.message || 'Check console'}`);
                          } finally {
                            setUploadingImage(false);
                          }
                        }} />
                      </label>
                    )}
                  </div>

                  {/* Dish Video Clip (Autoplay & Looping) */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-purple-400" />
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                          Dish Video Clip <span className="text-zinc-500 font-normal">(Optional · Autoplays in dish view)</span>
                        </label>
                      </div>
                      {videoUrl && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          VIDEO ACTIVE
                        </span>
                      )}
                    </div>

                    {videoUrl ? (
                      <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/10 group bg-black/60">
                        <video autoPlay loop muted playsInline src={videoUrl} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                          <label className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] cursor-pointer transition-all">
                            Replace Video
                            <input
                              type="file"
                              className="hidden"
                              accept="video/mp4,video/webm,video/quicktime"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingVideo(true);
                                try {
                                  const res = await api.uploadVideo(file);
                                  if (res?.url) setVideoUrl(res.url);
                                  toast.success("Video uploaded!");
                                } catch (err: any) {
                                  toast.error(`Video upload error: ${err.message || 'Failed'}`);
                                } finally {
                                  setUploadingVideo(false);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setVideoUrl("")}
                            className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] transition-all flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className={`w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${uploadingVideo ? "border-purple-500/50 bg-purple-500/5" : "border-white/10 hover:border-purple-400/40 hover:bg-purple-500/5 bg-white/[0.01]"}`}>
                        {uploadingVideo ? (
                          <>
                            <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Uploading Video…</span>
                          </>
                        ) : (
                          <>
                            <Film className="w-6 h-6 text-purple-400/70 mb-1.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Click to upload food video</span>
                            <span className="text-[9px] text-zinc-500 mt-0.5">Best: <strong>16:9 Landscape (1920 × 1080 px)</strong> · <strong>4–8s loop</strong> · Max 100MB</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="video/mp4,video/webm,video/quicktime"
                          disabled={uploadingVideo}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingVideo(true);
                            try {
                              const res = await api.uploadVideo(file);
                              if (res?.url) {
                                setVideoUrl(res.url);
                                toast.success("Food video uploaded!");
                              }
                            } catch (err: any) {
                              toast.error(`Video upload error: ${err.message || 'Failed'}`);
                            } finally {
                              setUploadingVideo(false);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Additional Gallery Photos */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ImagePlus className="w-4 h-4 text-emerald-400" />
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                          Additional Gallery Photos <span className="text-zinc-500 font-normal">({galleryImages.length} uploaded)</span>
                        </label>
                      </div>
                    </div>

                    {/* Gallery Thumbnails Grid */}
                    {galleryImages.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                        {galleryImages.map((img, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/10 aspect-square bg-black/40">
                            <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-1.5 p-1">
                              <button
                                type="button"
                                title="Set as primary cover"
                                onClick={() => {
                                  const oldCover = imageUrl;
                                  setImageUrl(img);
                                  setGalleryImages(prev => prev.map((item, i) => i === idx ? oldCover : item).filter(Boolean));
                                  toast.success("Set as primary cover image");
                                }}
                                className="px-2 py-1 rounded bg-amber-500/80 hover:bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-1"
                              >
                                <Star className="w-3 h-3" /> Make Cover
                              </button>
                              <button
                                type="button"
                                title="Delete image"
                                onClick={() => setGalleryImages(prev => prev.filter((_, i) => i !== idx))}
                                className="px-2 py-1 rounded bg-red-500/80 hover:bg-red-500 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload More Photos Dropzone */}
                    <label className={`w-full h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${uploadingGallery ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 hover:border-emerald-400/40 hover:bg-emerald-500/5 bg-white/[0.01]"}`}>
                      {uploadingGallery ? (
                        <>
                          <div className="w-6 h-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-2" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Uploading photos…</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-emerald-400/70 mb-1" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Add More Photos (Multi-select)</span>
                          <span className="text-[9px] text-zinc-500 mt-0.5">Best: <strong>16:9 Landscape (1920 × 1080 px)</strong> · Multiple files supported</span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*"
                        disabled={uploadingGallery}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          setUploadingGallery(true);
                          try {
                            const newUrls: string[] = [];
                            for (const file of files) {
                              const res = await api.uploadImage(file);
                              if (res?.url) newUrls.push(res.url);
                            }
                            if (newUrls.length > 0) {
                              setGalleryImages(prev => [...prev, ...newUrls]);
                              toast.success(`Added ${newUrls.length} photo${newUrls.length > 1 ? 's' : ''}`);
                            }
                          } catch (err: any) {
                            toast.error(`Gallery upload error: ${err.message || 'Failed'}`);
                          } finally {
                            setUploadingGallery(false);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Zone Selector */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Menu Zone</label>
                    <select
                      name="zone_id"
                      value={modalZoneId}
                      onChange={(e) => setModalZoneId(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white appearance-none"
                    >
                      <option value="" disabled className="bg-zinc-900">Select Delivery Zone…</option>
                      {zones.map(z => <option key={z.id} value={z.id} className="bg-zinc-900">{z.name}</option>)}
                    </select>
                  </div>

                  {/* Name + Category */}
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Name</label>
                      <input name="name" defaultValue={editingItem?.name} required placeholder="e.g. Paneer Tikka" className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white placeholder-zinc-600" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Category</label>
                      <select name="category" defaultValue={editingItem?.category ?? ""} required className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white appearance-none">
                        <option value="" disabled className="bg-zinc-900">Select…</option>
                        {modalCategories.map(c => (
                          <option key={c} value={c} className="bg-zinc-900">{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Description</label>
                    <textarea name="description" defaultValue={editingItem?.description || ""} placeholder="Describe the gourmet experience..." rows={3} className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white placeholder-zinc-600 resize-none"></textarea>
                  </div>

                  {/* Price + Station */}
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Price (₹)</label>
                      <input name="price" type="number" step="0.01" min="0" defaultValue={editingItem?.price_paise ? editingItem.price_paise / 100 : ""} required placeholder="0.00" className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white placeholder-zinc-600" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Station</label>
                      <select name="station" defaultValue={editingItem?.station ?? "main"} className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white appearance-none">
                        <option value="main" className="bg-zinc-900">Main Kitchen</option>
                        <option value="cold" className="bg-zinc-900">Cold Station</option>
                        <option value="grill" className="bg-zinc-900">Grill Station</option>
                        <option value="dessert" className="bg-zinc-900">Dessert Station</option>
                        <option value="beverages" className="bg-zinc-900">Beverages</option>
                      </select>
                    </div>
                  </div>

                  {/* Dietary */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Dietary Type</label>
                    <select name="dietary_type" defaultValue={editingItem?.is_egg ? "egg" : (editingItem?.is_veg ? "veg" : "non_veg")} className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white appearance-none">
                      <option value="veg" className="bg-zinc-900">Veg</option>
                      <option value="non_veg" className="bg-zinc-900">Non-Veg</option>
                      <option value="egg" className="bg-zinc-900">Egg</option>
                    </select>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-3 flex-1 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer hover:border-yellow-500/30 transition-all">
                      <input type="checkbox" name="is_bestseller" defaultChecked={!!editingItem?.is_bestseller} className="w-4 h-4 accent-yellow-500 rounded" />
                      <span className="text-xs font-black text-zinc-300">★ Bestseller</span>
                    </label>
                    <label className="flex items-center gap-3 flex-1 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer hover:border-purple-500/30 transition-all">
                      <input type="checkbox" name="is_new" defaultChecked={!!editingItem?.is_new} className="w-4 h-4 accent-purple-500 rounded" />
                      <span className="text-xs font-black text-zinc-300">+ New</span>
                    </label>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Tags <span className="text-zinc-600 font-medium normal-case tracking-normal">(comma-separated, e.g. Serves 1, High Protein)</span></label>
                    <input name="tags" defaultValue={editingItem?.tags?.join(", ") || ""} placeholder="Serves 1, High Protein, 2 Pieces" className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 font-bold text-sm focus:outline-none focus:ring-2 ring-swish-green/20 text-white placeholder-zinc-600" />
                  </div>

                  {/* Customization Groups Editor */}
                  <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.01]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-black text-white">Customization Groups</h4>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Add-ons, Size, Spice Level, etc.</p>
                        <p className="text-[9px] text-brand-primary uppercase tracking-widest mt-1">Recommended image size for options: 150x150 pixels</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomizationGroups([...customizationGroups, { name: "", required: false, options: [{ name: "", price_paise: 0 }] }])}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Group
                      </button>
                    </div>

                    {customizationGroups.length === 0 ? (
                      <div className="text-center py-6 text-zinc-600 text-xs font-bold border border-white/5 border-dashed rounded-xl">
                        No customizations. Item will be added directly to cart.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {customizationGroups.map((group, gIdx) => (
                          <div key={gIdx} className="border border-white/10 rounded-xl p-4 bg-black/40">
                            <div className="flex items-start gap-4 mb-4">
                              <div className="flex-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5 block">Group Name</label>
                                <input
                                  required
                                  value={group.name}
                                  onChange={e => {
                                    const next = [...customizationGroups];
                                    next[gIdx].name = e.target.value;
                                    setCustomizationGroups(next);
                                  }}
                                  placeholder="e.g. Spice Level"
                                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 font-bold text-sm text-white focus:outline-none focus:border-swish-green/50"
                                />
                              </div>
                              <div className="flex items-center gap-3 pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={group.required}
                                    onChange={e => {
                                      const next = [...customizationGroups];
                                      next[gIdx].required = e.target.checked;
                                      setCustomizationGroups(next);
                                    }}
                                    className="w-4 h-4 accent-swish-green rounded"
                                  />
                                  <span className="text-xs font-bold text-zinc-300">Required</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setCustomizationGroups(customizationGroups.filter((_, i) => i !== gIdx))}
                                  className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2 pl-4 border-l-2 border-white/5">
                              {group.options.map((opt: any, oIdx: number) => (
                                <div key={oIdx} className="flex items-center gap-3">
                                  {/* Option Image Upload */}
                                  <div className="relative w-11 h-11 rounded-lg bg-white/[0.02] border-2 border-dashed border-white/20 hover:border-swish-green/50 hover:bg-swish-green/5 flex-shrink-0 flex items-center justify-center overflow-hidden group transition-all">
                                    {opt.photo_url ? (
                                      <>
                                        <img src={opt.photo_url} alt="Option" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = [...customizationGroups];
                                              next[gIdx].options[oIdx].photo_url = "";
                                              setCustomizationGroups(next);
                                            }}
                                            className="text-red-400"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.05] transition-all">
                                        {uploadingOptionImage?.gIdx === gIdx && uploadingOptionImage?.oIdx === oIdx ? (
                                          <div className="w-4 h-4 rounded-full border-2 border-swish-green border-t-transparent animate-spin" />
                                        ) : (
                                          <ImagePlus className="w-4 h-4 text-zinc-500 group-hover:text-swish-green transition-colors" />
                                        )}
                                        <input
                                          type="file"
                                          className="hidden"
                                          accept="image/*"
                                          onChange={async (e) => {
                                            if (!e.target.files?.[0]) return;
                                            setUploadingOptionImage({ gIdx, oIdx });
                                            try {
                                              const fData = new FormData();
                                              fData.append("image", e.target.files[0]);
                                              const res = await api.request("/admin/menu/upload", {
                                                method: "POST",
                                                body: fData,
                                              });
                                              if (res.url) {
                                                const next = [...customizationGroups];
                                                next[gIdx].options[oIdx].photo_url = res.url;
                                                setCustomizationGroups(next);
                                              }
                                            } catch (err: any) {
                                              toast.error(`Upload error: ${err.message}`);
                                            } finally {
                                              setUploadingOptionImage(null);
                                            }
                                          }}
                                        />
                                      </label>
                                    )}
                                  </div>

                                  <input
                                    required
                                    value={opt.name}
                                    onChange={e => {
                                      const next = [...customizationGroups];
                                      next[gIdx].options[oIdx].name = e.target.value;
                                      setCustomizationGroups(next);
                                    }}
                                    placeholder="Option name (e.g. Mild)"
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm font-medium text-white focus:outline-none focus:border-swish-green/50"
                                  />
                                  <div className="relative w-24 flex-shrink-0">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₹</span>
                                    <input
                                      required
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={opt._rawPrice !== undefined ? opt._rawPrice : (opt.price_paise ? opt.price_paise / 100 : "")}
                                      onChange={e => {
                                        const next = [...customizationGroups];
                                        next[gIdx].options[oIdx]._rawPrice = e.target.value;
                                        next[gIdx].options[oIdx].price_paise = Math.round(parseFloat(e.target.value || "0") * 100);
                                        setCustomizationGroups(next);
                                      }}
                                      onBlur={() => {
                                        const next = [...customizationGroups];
                                        delete next[gIdx].options[oIdx]._rawPrice;
                                        setCustomizationGroups(next);
                                      }}
                                      className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm font-medium text-white focus:outline-none focus:border-swish-green/50"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...customizationGroups];
                                      next[gIdx].options = next[gIdx].options.filter((_: any, i: number) => i !== oIdx);
                                      setCustomizationGroups(next);
                                    }}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-all"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...customizationGroups];
                                  next[gIdx].options.push({ name: "", price_paise: 0 });
                                  setCustomizationGroups(next);
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-swish-green hover:text-swish-green/80 flex items-center gap-1 pt-2"
                              >
                                <Plus className="w-3 h-3" /> Add Option
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    {editingItem && (
                      <button
                        type="button"
                        onClick={() => setConfirmDialog({ isOpen: true, id: editingItem.id })}
                        className="py-4 px-5 rounded-2xl bg-red-500/10 text-red-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all"
                      >Delete</button>
                    )}
                    <button disabled={isSaving} type="submit" className="flex-1 py-4 rounded-2xl bg-swish-green/15 text-swish-green font-black text-[10px] uppercase tracking-[0.2em] hover:bg-swish-green hover:text-black transition-all shadow-xl shadow-swish-green/10 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSaving ? "Saving..." : (editingItem ? "Save Changes" : "Publish to Menu")}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Delete Menu Item?"
        message="Are you sure you want to delete this menu item permanently? This action cannot be undone."
        confirmText="Delete Item"
        onConfirm={async () => {
          if (!confirmDialog.id) return;
          try {
            await api.delete(`/admin/menu/${confirmDialog.id}`);
            setShowAddModal(false);
            setEditingItem(null);
            load();
            toast.success("Item deleted");
          } catch (err: any) {
            toast.error(err.message || "Failed to delete item");
          } finally {
            setConfirmDialog({ isOpen: false, id: null });
          }
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, id: null })}
        isDanger={true}
      />
    </div>
  );
}
