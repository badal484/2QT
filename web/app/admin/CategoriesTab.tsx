"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useSocketRefresh } from "../hooks/useSocketRefresh";
import { toast } from "sonner";
import { LayoutGrid, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface Category {
  id: string;
  zone_id: string;
  name: string;
  slug: string;
  image_url: string;
  banner_url: string;
  sort_order: number;
  is_active: boolean;
}

interface Zone {
  id: string;
  name: string;
}

// ── Slug Picker ────────────────────────────────────────────────────────────────
const SlugPicker = ({ value, onChange, zoneId }: { value: string; onChange: (v: string) => void; zoneId: string }) => {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!zoneId) return;
    api.get(`/categories/admin/slugs?zoneId=${zoneId}`)
      .then((res) => setSlugs(res?.slugs ?? []))
      .catch(() => {});
  }, [zoneId]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category Slug</label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">— Pick from existing menu items —</option>
          {slugs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or type manually"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <p className="text-xs text-yellow-400 flex items-center gap-1">
        <AlertCircle size={11} />
        Must exactly match the <code className="bg-gray-800 px-1 rounded">category</code> field on menu items (case-insensitive)
      </p>
    </div>
  );
};

// ── Image Upload ───────────────────────────────────────────────────────────────
const ImageUpload = ({ value, onChange, label, hint }: { value: string; onChange: (url: string) => void; label: string; hint?: string }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      onChange(res.url);
      toast.success("Image uploaded!");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      {hint && <p className="text-[11px] text-gray-500 mb-1 leading-tight">{hint}</p>}
      <div className="flex items-center gap-3">
        <div
          className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden bg-gray-800 cursor-pointer hover:border-orange-500 transition-colors flex-shrink-0"
          onClick={() => fileRef.current?.click()}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <Upload size={20} className="text-gray-500" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
            ) : (
              <><Upload size={14} /> {value ? "Change Image" : "Upload Image"}</>
            )}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="w-full text-xs text-red-400 hover:text-red-300 transition-colors">
              Remove image
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

// ── Modal ──────────────────────────────────────────────────────────────────────
const CategoryModal = ({
  category, zones, defaultZoneId, onClose, onSaved,
}: {
  category?: Category; zones: Zone[]; defaultZoneId: string; onClose: () => void; onSaved: () => void;
}) => {
  const [form, setForm] = useState({
    zone_id: category?.zone_id ?? defaultZoneId,
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    image_url: category?.image_url ?? "",
    banner_url: category?.banner_url ?? "",
    sort_order: category?.sort_order ?? 0,
    is_active: category?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.slug.trim()) return toast.error("Slug is required");
    if (!form.zone_id) return toast.error("Zone is required");
    setSaving(true);
    try {
      if (category) {
        await api.patch(`/categories/admin/${category.id}`, form);
        toast.success("Category updated!");
      } else {
        await api.post("/categories/admin", form);
        toast.success("Category created!");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutGrid size={18} className="text-orange-400" />
            {category ? "Edit Category" : "New Category"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone</label>
            <select
              value={form.zone_id}
              onChange={(e) => setForm(f => ({ ...f, zone_id: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Display Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Biryani & Rice"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <SlugPicker value={form.slug} onChange={(v) => setForm(f => ({ ...f, slug: v }))} zoneId={form.zone_id} />
          
          <div className="space-y-4 pt-2 border-t border-gray-800">
            <ImageUpload 
              value={form.image_url} 
              onChange={(url) => setForm(f => ({ ...f, image_url: url }))} 
              label="Home Screen Icon"
              hint="Circular icon shown on the Home screen. Recommended: 150x150 square."
            />
            <ImageUpload 
              value={form.banner_url} 
              onChange={(url) => setForm(f => ({ ...f, banner_url: url }))} 
              label="Top Banner Image"
              hint="Hero banner shown at the top of the Category screen. Recommended size: 1000x600 (landscape)."
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort Order</label>
              <input
                type="number" min={0} value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${form.is_active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-gray-800 text-gray-400 border border-gray-700"}`}
              >
                {form.is_active ? <><CheckCircle2 size={14} /> Active</> : <><EyeOff size={14} /> Hidden</>}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl font-semibold transition-colors">Cancel</button>
          <button
            onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold transition-colors"
          >
            {saving ? "Saving…" : category ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Tab ───────────────────────────────────────────────────────────────────
export const CategoriesTab = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const effectiveZoneId = selectedZoneId || zones[0]?.id || "";

  useEffect(() => {
    api.get("/admin/zones").then((res) => {
      const raw: Zone[] = res?.zones ?? [];
      // Deduplicate by id (guards against duplicate rows in DB)
      const seen = new Set<string>();
      const unique = raw.filter(z => { if (seen.has(z.id)) return false; seen.add(z.id); return true; });
      setZones(unique);
      if (unique.length > 0) setSelectedZoneId(unique[0].id);
    }).catch(() => {});
  }, []);

  const loadCategories = useCallback(() => {
    if (!effectiveZoneId) return;
    setLoading(true);
    api.get(`/categories/admin?zoneId=${effectiveZoneId}`)
      .then((res) => setCategories(res?.categories ?? []))
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoading(false));
  }, [effectiveZoneId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useSocketRefresh(["menu_updated"], loadCategories);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/admin/${deleteConfirm}`);
      toast.success("Category deleted");
      setDeleteConfirm(null);
      loadCategories();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleReorder = async (updated: Category[]) => {
    try {
      await api.patch("/categories/admin/reorder", {
        orders: updated.map((c, i) => ({ id: c.id, sort_order: i })),
      });
      loadCategories();
    } catch {
      toast.error("Reorder failed");
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...categories];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    handleReorder(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const updated = [...categories];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    handleReorder(updated);
  };

  const handleToggle = async (cat: Category) => {
    try {
      await api.patch(`/categories/admin/${cat.id}`, { is_active: !cat.is_active });
      loadCategories();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LayoutGrid className="text-orange-400" size={24} /> Menu Categories
          </h2>
          <p className="text-gray-400 text-sm mt-1">Zone-specific image categories shown on the customer app</p>
        </div>
        <button
          onClick={() => { setEditingCategory(undefined); setModalOpen(true); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Zone selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone:</span>
        <div className="flex gap-2 flex-wrap">
          {zones.map((z) => (
            <button
              key={z.id}
              onClick={() => setSelectedZoneId(z.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${effectiveZoneId === z.id ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300">
          <strong>Categories are zone-specific.</strong> The <code className="bg-blue-900/40 px-1 rounded">slug</code> must exactly match the category name used on menu items in this zone.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <LayoutGrid size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">No categories yet</p>
          <p className="text-sm mt-1">Add your first category for this zone</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className={`bg-gray-800/60 border rounded-2xl p-4 flex items-center gap-4 transition-all ${cat.is_active ? "border-gray-700" : "border-gray-800 opacity-60"}`}
            >
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border-2 border-gray-600">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <LayoutGrid size={20} className="text-gray-500" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white truncate">{cat.name}</span>
                  {!cat.is_active && <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Hidden</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">{cat.slug}</code>
                  <span className="text-xs text-gray-500">order: {cat.sort_order}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-20 transition-colors">
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => handleMoveDown(index)} disabled={index === categories.length - 1} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-20 transition-colors">
                  <ChevronDown size={16} />
                </button>
                <button onClick={() => handleToggle(cat)} className={`p-2 rounded-lg transition-colors ${cat.is_active ? "hover:bg-gray-700 text-emerald-400" : "hover:bg-gray-700 text-gray-500"}`}>
                  {cat.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => { setEditingCategory(cat); setModalOpen(true); }} className="p-2 rounded-lg hover:bg-gray-700 text-blue-400 transition-colors">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setDeleteConfirm(cat.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold">Delete Category?</p>
                <p className="text-sm text-gray-400">This will hide it from the customer app immediately.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl font-semibold transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <CategoryModal
          category={editingCategory}
          zones={zones}
          defaultZoneId={effectiveZoneId}
          onClose={() => { setModalOpen(false); setEditingCategory(undefined); }}
          onSaved={loadCategories}
        />
      )}
    </div>
  );
};
