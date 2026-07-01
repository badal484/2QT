"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, X, Edit3, Globe, MapPin, Search, ChevronDown } from "lucide-react";

interface TargetResult { id: string; name: string; sub?: string }

function TargetSearch({
  targetType,
  value,
  label: selectedLabel,
  onChange,
}: {
  targetType: string;
  value: string;
  label: string;
  onChange: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState(selectedLabel || "");
  const [results, setResults] = useState<TargetResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync label when editing an existing offer
  useEffect(() => { if (selectedLabel) setQuery(selectedLabel); }, [selectedLabel]);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/offer-targets?type=${targetType}&q=${encodeURIComponent(q)}`);
      setResults(data.results ?? []);
      setOpen(true);
    } catch { setResults([]); }
    setLoading(false);
  }, [targetType]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(val), 280);
    if (!val) { onChange("", ""); setResults([]); setOpen(false); }
  };

  const handleFocus = () => { if (!results.length) search(query); };

  const select = (r: TargetResult) => {
    setQuery(r.name);
    onChange(r.id, r.name);
    setOpen(false);
  };

  const typeLabel: Record<string, string> = { item: "item", kitchen: "kitchen", category: "category" };

  return (
    <div ref={containerRef} className="relative">
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">
        Target {typeLabel[targetType] ?? targetType}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        <input
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          placeholder={`Search ${typeLabel[targetType] ?? "target"} by name…`}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-8 pr-8 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50 placeholder:text-zinc-600"
        />
        {value && (
          <button
            onClick={() => { setQuery(""); onChange("", ""); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {loading && !value && (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 animate-spin" />
        )}
      </div>

      {/* Selected badge */}
      {value && (
        <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-lg w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
          <span className="text-[10px] font-black text-brand-primary truncate max-w-[220px]">{query}</span>
          <span className="text-[9px] text-zinc-500 font-mono">{value.slice(0, 8)}…</span>
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => select(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] text-left transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{r.name}</div>
                {r.sub && <div className="text-[10px] text-zinc-500 truncate">{r.sub}</div>}
              </div>
              <div className="text-[9px] text-zinc-600 font-mono shrink-0">{r.id.slice(0, 8)}…</div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-500">
          No {typeLabel[targetType]}s found for "{query}"
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  title: "",
  description: "",
  target_type: "all",
  target_id: "",
  discount_type: "percent",
  discount_percent: "",
  discount_flat_paise: "",
  max_discount_paise: "",
  audience: "all",
  zone_id: "",
  start_time: "",
  end_time: "",
  is_active: true,
};

export function MenuOffersTab() {
  const [offers, setOffers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [targetLabel, setTargetLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [o, z] = await Promise.all([
        api.get("/menu-offers/admin"),
        api.get("/admin/zones"),
      ]);
      setOffers(o.offers ?? []);
      setZones(z.zones ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTargetLabel("");
    setShowModal(true);
  };

  const openEdit = (offer: any) => {
    setEditing(offer);
    setTargetLabel(offer.target_name ?? "");
    setForm({
      title: offer.title,
      description: offer.description ?? "",
      target_type: offer.target_type,
      target_id: offer.target_id ?? "",
      discount_type: offer.discount_type,
      discount_percent: offer.discount_percent ?? "",
      discount_flat_paise: offer.discount_flat_paise ?? "",
      max_discount_paise: offer.max_discount_paise ?? "",
      audience: offer.audience ?? "all",
      zone_id: offer.zone_id ?? "",
      start_time: offer.start_time ? offer.start_time.slice(0, 16) : "",
      end_time: offer.end_time ? offer.end_time.slice(0, 16) : "",
      is_active: offer.is_active,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        target_id: form.target_id || null,
        discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : 0,
        discount_flat_paise: form.discount_flat_paise ? parseInt(form.discount_flat_paise) : 0,
        max_discount_paise: form.max_discount_paise ? parseInt(form.max_discount_paise) : null,
        zone_id: form.zone_id || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };
      if (editing) {
        await api.patch(`/menu-offers/admin/${editing.id}`, payload);
        toast.success("Offer updated");
      } else {
        await api.post("/menu-offers/admin", payload);
        toast.success("Offer created");
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save offer");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (offer: any) => {
    try {
      await api.patch(`/menu-offers/admin/${offer.id}`, { is_active: !offer.is_active });
      load();
    } catch {
      toast.error("Failed to toggle offer");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this offer?")) return;
    try {
      await api.delete(`/menu-offers/admin/${id}`);
      toast.success("Offer deleted");
      load();
    } catch {
      toast.error("Failed to delete offer");
    }
  };

  const f = (label: string, key: string, type = "text", placeholder = "") => (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={form[key] ?? ""}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50 [color-scheme:dark]"
      />
    </div>
  );

  const sel = (label: string, key: string, options: { value: string; label: string }[]) => (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      <select
        value={form[key] ?? ""}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const targetTypeLabel: Record<string, string> = {
    all: "All Items",
    kitchen: "Kitchen",
    category: "Category",
    item: "Item",
  };

  const audienceLabel: Record<string, string> = {
    all: "Everyone",
    new_users: "New Users",
    plus_subscribers: "Plus Members",
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Menu Offers</h2>
          <p className="text-zinc-400 text-sm font-medium">Item-level discounts applied automatically at checkout. Zone and audience targeted.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-dark shadow-lg shadow-brand-primary/30 shrink-0"
        >
          <Plus className="w-4 h-4" /> New Offer
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />)}</div>
      ) : offers.length === 0 ? (
        <div className="py-24 text-center border border-white/10 border-dashed rounded-2xl">
          <Tag className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 text-sm font-bold">No menu offers yet. Create one to start targeting customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(offer => (
            <div key={offer.id} className={`bg-white/[0.03] border rounded-2xl p-5 flex items-center gap-5 shadow-xl shadow-black/30 ${offer.is_active ? "border-white/10" : "border-white/5 opacity-50"}`}>
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-brand-primary" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="font-black text-white text-sm">{offer.title}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {targetTypeLabel[offer.target_type] ?? offer.target_type}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                    {audienceLabel[offer.audience] ?? offer.audience}
                  </span>
                  {offer.zone_name ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-[9px] font-black uppercase tracking-widest text-blue-400">
                      <MapPin className="w-2.5 h-2.5" />{offer.zone_name}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] text-[9px] font-black uppercase tracking-widest text-zinc-500">
                      <Globe className="w-2.5 h-2.5" />All Zones
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 font-medium">
                  {offer.discount_type === "percent"
                    ? `${offer.discount_percent}% off${offer.max_discount_paise ? ` · max ₹${offer.max_discount_paise / 100}` : ""}`
                    : `₹${offer.discount_flat_paise / 100} flat off`}
                  {offer.end_time && ` · expires ${new Date(offer.end_time).toLocaleDateString()}`}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(offer)} className="text-zinc-400 hover:text-white transition-colors p-1">
                  {offer.is_active
                    ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                    : <ToggleLeft className="w-6 h-6" />}
                </button>
                <button onClick={() => openEdit(offer)} className="p-2 rounded-lg hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => remove(offer.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-black text-white">{editing ? "Edit Offer" : "New Menu Offer"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-5">
              <div className="col-span-2">{f("Offer Title *", "title", "text", "e.g. 50% off Biryani")}</div>
              <div className="col-span-2">{f("Description (shown to customer)", "description", "text", "e.g. Limited time offer on all biryanis")}</div>

              <div className="col-span-2 border-t border-white/5 pt-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Targeting</div>
              </div>

              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Applies To</div>
                <select
                  value={form.target_type}
                  onChange={e => {
                    setForm({ ...form, target_type: e.target.value, target_id: "" });
                    setTargetLabel("");
                  }}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-primary/50"
                >
                  <option value="all">All Items in Zone</option>
                  <option value="kitchen">Specific Kitchen</option>
                  <option value="category">Specific Category</option>
                  <option value="item">Specific Item</option>
                </select>
              </div>

              {form.target_type !== "all" ? (
                <TargetSearch
                  targetType={form.target_type}
                  value={form.target_id}
                  label={targetLabel}
                  onChange={(id, name) => {
                    setForm((p: any) => ({ ...p, target_id: id }));
                    setTargetLabel(name);
                  }}
                />
              ) : <div />}

              {sel("Zone", "zone_id", [
                { value: "", label: "All Zones (Global)" },
                ...zones.map(z => ({ value: z.id, label: `${z.name} — ${z.city}` })),
              ])}
              {sel("Audience", "audience", [
                { value: "all", label: "Everyone" },
                { value: "new_users", label: "New Users (0 delivered orders)" },
                { value: "plus_subscribers", label: "Plus Subscribers only" },
              ])}

              <div className="col-span-2 border-t border-white/5 pt-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Discount</div>
              </div>

              {sel("Discount Type", "discount_type", [
                { value: "percent", label: "Percentage (%)" },
                { value: "flat", label: "Flat Amount (₹)" },
              ])}
              {form.discount_type === "percent"
                ? f("Discount %", "discount_percent", "number", "e.g. 50")
                : f("Flat Discount (paise)", "discount_flat_paise", "number", "e.g. 5000 = ₹50")}
              {f("Max Discount Cap (paise)", "max_discount_paise", "number", "e.g. 15000 = ₹150 cap")}
              <div />

              <div className="col-span-2 border-t border-white/5 pt-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Schedule</div>
              </div>

              {f("Start Time (optional)", "start_time", "datetime-local")}
              {f("End Time (optional)", "end_time", "datetime-local")}

              <div className="col-span-2 flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 accent-brand-primary rounded"
                  />
                  <span className="text-sm font-bold text-white">Active (live immediately)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-white/[0.05] text-sm font-black text-white hover:bg-white/10">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-sm font-black hover:bg-brand-dark disabled:opacity-60 shadow-lg shadow-brand-primary/30">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
