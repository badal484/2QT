"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, X, Plus, ChevronRight,
  Copy, Check, MapPin, Phone,
  ToggleLeft, ToggleRight, Trash2,
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmt = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};

const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map(d => [d, { open: "11:00", close: "23:00", closed: false }])
);

// ─── Input helpers ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition ${props.className ?? ""}`}
    />
  );
}

function Select({ value, onChange, children, disabled }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-[#0f0f1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/60 transition"
    >
      {children}
    </select>
  );
}

// ─── Success Banner ────────────────────────────────────────────────────────────
function SuccessBanner({ partner, restaurant, tables, loginInstruction, onDismiss }: {
  partner: any; restaurant: any; tables: any[]; loginInstruction: string; onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyPhone = () => {
    navigator.clipboard.writeText(partner.phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-emerald-400 font-black text-lg">Restaurant Onboarded!</div>
          <div className="text-white/60 text-sm mt-0.5">{restaurant.name} is now live in the system</div>
        </div>
        <button onClick={onDismiss} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="bg-white/5 rounded-xl p-4 space-y-3">
        <div className="text-xs text-white/40 uppercase tracking-wide">Partner Login Credentials</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">{partner.name}</div>
            <div className="text-white/60 text-sm font-mono">{partner.phone}</div>
          </div>
          <button
            onClick={copyPhone}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy phone"}
          </button>
        </div>
        <div className="text-xs text-white/50 bg-white/5 rounded-lg px-3 py-2">
          {loginInstruction}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3">
          <div className="text-xs text-white/40 mb-1">Restaurant ID</div>
          <div className="text-white text-sm font-mono">{restaurant.id}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="text-xs text-white/40 mb-1">Tables Added</div>
          <div className="text-white text-sm font-semibold">{tables.length}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Operating Hours Editor ────────────────────────────────────────────────────
function OperatingHoursEditor({ value, onChange }: {
  value: Record<string, { open: string; close: string; closed: boolean }>;
  onChange: (v: Record<string, { open: string; close: string; closed: boolean }>) => void;
}) {
  const update = (day: string, field: string, val: string | boolean) => {
    onChange({ ...value, [day]: { ...value[day], [field]: val } });
  };

  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const h = value[day] || { open: "11:00", close: "23:00", closed: false };
        return (
          <div key={day} className="flex items-center gap-3">
            <div className="w-10 text-xs text-white/50 font-mono">{DAY_LABEL[day]}</div>
            <button
              type="button"
              onClick={() => update(day, "closed", !h.closed)}
              className={`text-xs px-2 py-1 rounded-md transition ${h.closed ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
            >
              {h.closed ? "Closed" : "Open"}
            </button>
            {!h.closed && (
              <>
                <input
                  type="time" value={h.open}
                  onChange={e => update(day, "open", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500/60 w-24"
                />
                <span className="text-white/30 text-xs">–</span>
                <input
                  type="time" value={h.close}
                  onChange={e => update(day, "close", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500/60 w-24"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tables Editor (for onboarding form) ──────────────────────────────────────
type TableRow = { tableNumber: string; capacity: string };

function TablesEditor({ tables, onChange }: {
  tables: TableRow[];
  onChange: (t: TableRow[]) => void;
}) {
  const add = () => onChange([...tables, { tableNumber: String(tables.length + 1), capacity: "4" }]);
  const remove = (i: number) => onChange(tables.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof TableRow, val: string) => {
    const next = tables.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {tables.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              placeholder="Table #"
              value={t.tableNumber}
              onChange={e => update(i, "tableNumber", e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Capacity"
              type="number"
              min={1}
              value={t.capacity}
              onChange={e => update(i, "capacity", e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full border border-dashed border-white/10 rounded-xl py-2 text-xs text-white/40 hover:text-white/60 hover:border-white/20 transition flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Add table
      </button>
    </div>
  );
}

// ─── Onboard Drawer ────────────────────────────────────────────────────────────
function OnboardDrawer({ zones, onClose, onSuccess }: {
  zones: any[];
  onClose: () => void;
  onSuccess: (result: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => {
    const z = zones[0];
    return {
      partnerPhone: "", partnerName: "",
      zoneId: z?.id ?? "",
      restaurantName: "", cuisineType: "", address: "",
      lat: z?.kitchen_lat != null ? String(z.kitchen_lat) : "",
      lng: z?.kitchen_lng != null ? String(z.kitchen_lng) : "",
      commissionPercent: "15", depositPaise: "200", gstPercent: "5",
      slotDurationMinutes: "90", advanceBookingDays: "7",
      cancellationWindowMinutes: "120", maxPartySize: "10",
      upiId: "",
    };
  });
  const [hours, setHours] = useState(DEFAULT_HOURS as Record<string, { open: string; close: string; closed: boolean }>);
  const [tables, setTables] = useState<TableRow[]>([
    { tableNumber: "1", capacity: "4" },
    { tableNumber: "2", capacity: "4" },
  ]);
  const [section, setSection] = useState<"partner" | "restaurant" | "tables" | "hours">("partner");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const setZone = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    setForm(f => ({
      ...f,
      zoneId,
      lat: zone?.kitchen_lat != null ? String(zone.kitchen_lat) : f.lat,
      lng: zone?.kitchen_lng != null ? String(zone.kitchen_lng) : f.lng,
    }));
  };

  const submit = async () => {
    if (!form.partnerPhone.trim() || !form.partnerName.trim() || !form.zoneId || !form.restaurantName.trim()) {
      toast.error("Fill in required fields: partner phone, name, zone, restaurant name");
      return;
    }
    setLoading(true);
    try {
      const result = await api.post("/admin/restaurants/onboard", {
        partnerPhone: form.partnerPhone.trim(),
        partnerName: form.partnerName.trim(),
        zoneId: form.zoneId,
        restaurantName: form.restaurantName.trim(),
        cuisineType: form.cuisineType.trim() || undefined,
        address: form.address.trim() || undefined,
        lat: form.lat ? parseFloat(form.lat) : undefined,
        lng: form.lng ? parseFloat(form.lng) : undefined,
        commissionPercent: parseFloat(form.commissionPercent) || 15,
        depositPaise: Math.round(parseFloat(form.depositPaise) * 100) || 20000,
        gstPercent: parseFloat(form.gstPercent) || 5,
        slotDurationMinutes: parseInt(form.slotDurationMinutes) || 90,
        advanceBookingDays: parseInt(form.advanceBookingDays) || 7,
        cancellationWindowMinutes: parseInt(form.cancellationWindowMinutes) || 120,
        maxPartySize: parseInt(form.maxPartySize) || 10,
        upiId: form.upiId.trim() || undefined,
        operatingHours: hours,
        tables: tables
          .filter(t => t.tableNumber.trim())
          .map(t => ({ tableNumber: t.tableNumber.trim(), capacity: parseInt(t.capacity) || 2 })),
      }) as any;
      toast.success(`${result.restaurant.name} onboarded successfully`);
      onSuccess(result);
    } catch (err: any) {
      toast.error(err?.message || "Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  const sectionBtn = (id: typeof section, label: string) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={`px-3 py-1.5 rounded-lg text-xs transition ${section === id ? "bg-purple-500/20 text-purple-300" : "text-white/40 hover:text-white/70"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative h-full w-full max-w-xl bg-[#0f0f1c] border-l border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-lg font-black text-white">Onboard Restaurant</div>
            <div className="text-xs text-white/40 mt-0.5">Create partner account + restaurant + tables in one step</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="px-6 py-3 border-b border-white/5 flex gap-1 flex-shrink-0">
          {sectionBtn("partner", "Partner")}
          {sectionBtn("restaurant", "Restaurant")}
          {sectionBtn("tables", "Tables")}
          {sectionBtn("hours", "Hours")}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {section === "partner" && (
            <>
              <Field label="Phone (login credential) *">
                <Input
                  placeholder="+91 98765 43210"
                  value={form.partnerPhone}
                  onChange={e => set("partnerPhone", e.target.value)}
                />
              </Field>
              <Field label="Partner / Owner Name *">
                <Input
                  placeholder="Rajan Sharma"
                  value={form.partnerName}
                  onChange={e => set("partnerName", e.target.value)}
                />
              </Field>
              <div className="text-xs text-white/30 bg-white/5 rounded-xl p-3 leading-relaxed">
                The partner will log in using their phone number + OTP. No password needed. Share only their phone number as credentials.
              </div>
            </>
          )}

          {section === "restaurant" && (
            <>
              <Field label="Restaurant Name *">
                <Input
                  placeholder="Spice Garden"
                  value={form.restaurantName}
                  onChange={e => set("restaurantName", e.target.value)}
                />
              </Field>
              <Field label="Zone *">
                <Select value={form.zoneId} onChange={setZone}>
                  <option value="">Select a zone…</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </Select>
              </Field>
              <Field label="Cuisine Type">
                <Input
                  placeholder="North Indian, Chinese, Multi-cuisine…"
                  value={form.cuisineType}
                  onChange={e => set("cuisineType", e.target.value)}
                />
              </Field>
              <Field label="Address">
                <Input
                  placeholder="123 MG Road, Bangalore"
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude (from zone)">
                  <Input
                    placeholder="Auto-filled from zone"
                    value={form.lat}
                    onChange={e => set("lat", e.target.value)}
                    className="opacity-60"
                  />
                </Field>
                <Field label="Longitude (from zone)">
                  <Input
                    placeholder="Auto-filled from zone"
                    value={form.lng}
                    onChange={e => set("lng", e.target.value)}
                    className="opacity-60"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Commission %">
                  <Input type="number" min={0} max={100} value={form.commissionPercent} onChange={e => set("commissionPercent", e.target.value)} />
                </Field>
                <Field label="GST %">
                  <Input type="number" min={0} max={28} value={form.gstPercent} onChange={e => set("gstPercent", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Security Deposit (₹)">
                  <Input type="number" min={0} value={form.depositPaise} onChange={e => set("depositPaise", e.target.value)} />
                </Field>
                <Field label="Max Party Size">
                  <Input type="number" min={1} value={form.maxPartySize} onChange={e => set("maxPartySize", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Slot Duration (min)">
                  <Input type="number" min={30} value={form.slotDurationMinutes} onChange={e => set("slotDurationMinutes", e.target.value)} />
                </Field>
                <Field label="Advance Booking Days">
                  <Input type="number" min={1} value={form.advanceBookingDays} onChange={e => set("advanceBookingDays", e.target.value)} />
                </Field>
              </div>
              <Field label="Cancellation Window (min)">
                <Input type="number" min={0} value={form.cancellationWindowMinutes} onChange={e => set("cancellationWindowMinutes", e.target.value)} />
              </Field>
              <Field label="UPI ID (for payouts)">
                <Input placeholder="restaurant@upi" value={form.upiId} onChange={e => set("upiId", e.target.value)} />
              </Field>
            </>
          )}

          {section === "tables" && (
            <div className="space-y-3">
              <div className="text-xs text-white/40">
                Add tables that guests can book. Table number can be any string (e.g., &quot;1&quot;, &quot;T-05&quot;, &quot;Terrace-1&quot;).
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-1">
                <div className="text-xs text-white/30 px-1">Table #</div>
                <div className="text-xs text-white/30 px-1">Capacity</div>
              </div>
              <TablesEditor tables={tables} onChange={setTables} />
            </div>
          )}

          {section === "hours" && (
            <div className="space-y-3">
              <div className="text-xs text-white/40">Set when each day is open for bookings.</div>
              <OperatingHoursEditor value={hours} onChange={setHours} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Onboarding…" : "Onboard Restaurant"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Restaurant Detail Drawer ──────────────────────────────────────────────────
function RestaurantDetailDrawer({ restaurant, onClose, onUpdated }: {
  restaurant: any; onClose: () => void; onUpdated: () => void;
}) {
  const [tab, setTab] = useState<"info" | "tables" | "menu" | "bookings" | "hours">("info");
  const [tables, setTables] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [toggling, setToggling] = useState(false);

  // New table form
  const [newTable, setNewTable] = useState({ tableNumber: "", capacity: "4" });
  const [addingTable, setAddingTable] = useState(false);

  // New menu item form
  const [newItem, setNewItem] = useState({ name: "", pricePaise: "", category: "", isVeg: true });
  const [addingItem, setAddingItem] = useState(false);

  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Operating hours edit
  const [editHours, setEditHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    () => {
      const base = { ...DEFAULT_HOURS };
      const existing = restaurant.operating_hours || {};
      for (const d of DAYS) {
        if (existing[d]) base[d] = existing[d];
      }
      return base;
    }
  );
  const [savingHours, setSavingHours] = useState(false);

  const saveHours = async () => {
    setSavingHours(true);
    try {
      await api.put(`/admin/restaurants/${restaurant.id}`, { operatingHours: editHours });
      toast.success("Operating hours saved");
    } catch {
      toast.error("Failed to save hours");
    } finally {
      setSavingHours(false);
    }
  };

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const r = await api.get(`/admin/restaurants/${restaurant.id}/tables`) as any;
      setTables(r.tables || []);
    } finally {
      setLoadingTables(false);
    }
  }, [restaurant.id]);

  const fetchMenu = useCallback(async () => {
    setLoadingMenu(true);
    try {
      const r = await api.get(`/admin/restaurants/${restaurant.id}/menu`) as any;
      setMenuItems(r.items || []);
    } finally {
      setLoadingMenu(false);
    }
  }, [restaurant.id]);

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const r = await api.get(`/admin/restaurants/${restaurant.id}/bookings?date=${bookingDate}`) as any;
      setBookings(r.bookings || []);
    } finally {
      setLoadingBookings(false);
    }
  }, [restaurant.id, bookingDate]);

  useEffect(() => {
    if (tab === "tables") fetchTables();
    if (tab === "menu") fetchMenu();
    if (tab === "bookings") fetchBookings();
  }, [tab, fetchTables, fetchMenu, fetchBookings]);

  useEffect(() => {
    if (tab === "bookings") fetchBookings();
  }, [bookingDate, fetchBookings, tab]);

  const toggleActive = async () => {
    setToggling(true);
    try {
      await api.put(`/admin/restaurants/${restaurant.id}`, { isActive: !restaurant.is_active });
      toast.success(`Restaurant ${restaurant.is_active ? "deactivated" : "activated"}`);
      onUpdated();
    } catch {
      toast.error("Failed to update");
    } finally {
      setToggling(false);
    }
  };

  const addTable = async () => {
    if (!newTable.tableNumber.trim()) return;
    setAddingTable(true);
    try {
      await api.post(`/admin/restaurants/${restaurant.id}/tables`, {
        tableNumber: newTable.tableNumber.trim(),
        capacity: parseInt(newTable.capacity) || 2,
      });
      toast.success("Table added");
      setNewTable({ tableNumber: "", capacity: "4" });
      fetchTables();
    } catch (err: any) {
      if (err?.message?.includes("TABLE_NUMBER_EXISTS")) toast.error("Table number already exists");
      else toast.error("Failed to add table");
    } finally {
      setAddingTable(false);
    }
  };

  const toggleTable = async (t: any) => {
    try {
      await api.put(`/admin/restaurants/${restaurant.id}/tables/${t.id}`, { isActive: !t.is_active });
      fetchTables();
    } catch {
      toast.error("Failed to update table");
    }
  };

  const addMenuItem = async () => {
    if (!newItem.name.trim() || !newItem.pricePaise) return;
    setAddingItem(true);
    try {
      await api.post(`/admin/restaurants/${restaurant.id}/menu`, {
        name: newItem.name.trim(),
        pricePaise: Math.round(parseFloat(newItem.pricePaise) * 100),
        category: newItem.category.trim() || undefined,
        isVeg: newItem.isVeg,
      });
      toast.success("Menu item added");
      setNewItem({ name: "", pricePaise: "", category: "", isVeg: true });
      fetchMenu();
    } catch {
      toast.error("Failed to add item");
    } finally {
      setAddingItem(false);
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: "text-yellow-400",
    confirmed: "text-blue-400",
    seated: "text-purple-400",
    completed: "text-emerald-400",
    cancelled: "text-red-400",
    no_show: "text-white/30",
  };

  const tabBtn = (id: "info" | "tables" | "menu" | "bookings" | "hours", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-lg text-xs transition ${tab === id ? "bg-purple-500/20 text-purple-300" : "text-white/40 hover:text-white/70"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative h-full w-full max-w-2xl bg-[#0f0f1c] border-l border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between flex-shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-lg font-black text-white">{restaurant.name}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${restaurant.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {restaurant.is_active ? "Active" : "Inactive"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${restaurant.restaurant_type === "partner" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
                {restaurant.restaurant_type === "partner" ? "Partner" : "Own"}
              </span>
            </div>
            <div className="text-sm text-white/40">{restaurant.zone_name} · {restaurant.cuisine_type || "Multi-cuisine"}</div>
            {restaurant.partner_name && (
              <div className="text-xs text-white/30">{restaurant.partner_name} · {restaurant.partner_phone}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition ${restaurant.is_active ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}
            >
              {restaurant.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {restaurant.is_active ? "Deactivate" : "Activate"}
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-white/5 flex gap-1 flex-shrink-0">
          {tabBtn("info", "Info")}
          {tabBtn("hours", "Hours")}
          {tabBtn("tables", "Tables")}
          {tabBtn("menu", "Menu")}
          {tabBtn("bookings", "Bookings")}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {tab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Commission", value: `${restaurant.commission_percent}%` },
                  { label: "GST", value: `${restaurant.gst_percent}%` },
                  { label: "Deposit", value: fmt(restaurant.deposit_paise || 0) },
                  { label: "Slot Duration", value: `${restaurant.slot_duration_minutes} min` },
                  { label: "Active Tables", value: restaurant.active_tables },
                  { label: "Bookings Today", value: restaurant.bookings_today },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <div className="text-xs text-white/40 mb-1">{label}</div>
                    <div className="text-white font-semibold">{value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-xs text-white/40 mb-1">Revenue (30d)</div>
                <div className="text-white font-semibold">{fmt(restaurant.revenue_30d_paise || 0)}</div>
              </div>
              {restaurant.address && (
                <div className="flex items-start gap-2 text-sm text-white/50">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{restaurant.address}</span>
                </div>
              )}
            </div>
          )}

          {tab === "tables" && (
            <div className="space-y-4">
              {/* Add new table */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Table #"
                  value={newTable.tableNumber}
                  onChange={e => setNewTable(t => ({ ...t, tableNumber: e.target.value }))}
                />
                <Input
                  type="number" min={1} placeholder="Capacity"
                  value={newTable.capacity}
                  onChange={e => setNewTable(t => ({ ...t, capacity: e.target.value }))}
                />
                <button
                  onClick={addTable}
                  disabled={addingTable || !newTable.tableNumber.trim()}
                  className="whitespace-nowrap px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {/* Tables list */}
              {loadingTables ? (
                <div className="text-center text-white/30 py-8">Loading…</div>
              ) : tables.length === 0 ? (
                <div className="text-center text-white/30 py-8">No tables yet</div>
              ) : (
                <div className="space-y-2">
                  {tables.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                      <div>
                        <div className="text-white text-sm font-semibold">Table {t.table_number}</div>
                        <div className="text-xs text-white/40">Capacity: {t.capacity}</div>
                      </div>
                      <button
                        onClick={() => toggleTable(t)}
                        className={`text-xs px-3 py-1 rounded-lg transition ${t.is_active ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "menu" && (
            <div className="space-y-4">
              {/* Add menu item */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div className="text-xs text-white/40 uppercase tracking-wide">Add Item</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Item name" value={newItem.name} onChange={e => setNewItem(i => ({ ...i, name: e.target.value }))} />
                  <Input type="number" placeholder="Price (₹)" value={newItem.pricePaise} onChange={e => setNewItem(i => ({ ...i, pricePaise: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Category (optional)" value={newItem.category} onChange={e => setNewItem(i => ({ ...i, category: e.target.value }))} />
                  <Select value={newItem.isVeg ? "veg" : "nonveg"} onChange={v => setNewItem(i => ({ ...i, isVeg: v === "veg" }))}>
                    <option value="veg">Veg</option>
                    <option value="nonveg">Non-Veg</option>
                  </Select>
                </div>
                <button
                  onClick={addMenuItem}
                  disabled={addingItem || !newItem.name.trim() || !newItem.pricePaise}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {addingItem ? "Adding…" : "Add to Menu"}
                </button>
              </div>

              {/* Menu list */}
              {loadingMenu ? (
                <div className="text-center text-white/30 py-8">Loading…</div>
              ) : menuItems.length === 0 ? (
                <div className="text-center text-white/30 py-8">No menu items yet</div>
              ) : (
                <div className="space-y-2">
                  {menuItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-sm border-2 flex-shrink-0 ${item.is_veg ? "border-emerald-400" : "border-red-400"}`}>
                          <div className={`w-1.5 h-1.5 rounded-full m-0.5 ${item.is_veg ? "bg-emerald-400" : "bg-red-400"}`} />
                        </div>
                        <div>
                          <div className="text-white text-sm font-semibold">{item.name}</div>
                          {item.category && <div className="text-xs text-white/40">{item.category}</div>}
                        </div>
                      </div>
                      <div className="text-white text-sm font-semibold">{fmt(item.price_paise)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "bookings" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  className="w-40"
                />
                <button onClick={fetchBookings} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <RefreshCw className={`w-4 h-4 text-white/60 ${loadingBookings ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingBookings ? (
                <div className="text-center text-white/30 py-8">Loading…</div>
              ) : bookings.length === 0 ? (
                <div className="text-center text-white/30 py-8">No bookings for this date</div>
              ) : (
                <div className="space-y-2">
                  {bookings.map((b: any) => (
                    <div key={b.id} className="bg-white/5 rounded-xl px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-white text-sm font-semibold">#{b.display_id} · {b.customer_name}</div>
                        <span className={`text-xs font-semibold ${STATUS_COLOR[b.status] || "text-white/50"}`}>{b.status}</span>
                      </div>
                      <div className="text-xs text-white/40">
                        Table {b.table_number} · {b.party_size} guests ·{" "}
                        {new Date(b.slot_start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(b.slot_end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {b.total_paid_paise > 0 && (
                        <div className="text-xs text-emerald-400">Paid: {fmt(b.total_paid_paise)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "hours" && (
            <div className="space-y-4">
              <div className="text-xs text-white/40">
                Configure when this restaurant accepts bookings. Slots are generated from open to close time.
              </div>
              <OperatingHoursEditor value={editHours} onChange={setEditHours} />
              <button
                onClick={saveHours}
                disabled={savingHours}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {savingHours ? "Saving…" : "Save Operating Hours"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Restaurant Card ───────────────────────────────────────────────────────────
function RestaurantCard({ restaurant, onClick }: { restaurant: any; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white/5 border border-white/8 rounded-2xl p-5 cursor-pointer hover:bg-white/8 hover:border-white/15 transition group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="text-white font-bold">{restaurant.name}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${restaurant.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {restaurant.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-xs text-white/40">{restaurant.zone_name} · {restaurant.cuisine_type || "Multi-cuisine"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${restaurant.restaurant_type === "partner" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
            {restaurant.restaurant_type === "partner" ? "Partner" : "Own"}
          </span>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition" />
        </div>
      </div>

      {restaurant.partner_name && (
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-3">
          <Phone className="w-3.5 h-3.5" />
          {restaurant.partner_name} · {restaurant.partner_phone}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Commission", value: `${restaurant.commission_percent}%` },
          { label: "Tables", value: restaurant.active_tables },
          { label: "Bookings", value: restaurant.bookings_today },
          { label: "Rev 30d", value: fmt(restaurant.revenue_30d_paise || 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
            <div className="text-white text-xs font-semibold">{value}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────
export function RestaurantsTab() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboard, setShowOnboard] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "partner" | "own">("all");

  const loadZones = useCallback(async () => {
    try {
      const zData = await api.get("/admin/zones") as any;
      setZones(zData.zones || []);
    } catch {
      // zones failing shouldn't block the page
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rData = await api.get("/admin/restaurants") as any;
      setRestaurants(rData.restaurants || []);
    } catch {
      toast.error("Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadZones();
    load();
  }, [load, loadZones]);

  const handleOnboardSuccess = (result: any) => {
    setShowOnboard(false);
    setSuccessResult(result);
    load();
  };

  const filtered = restaurants.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.zone_name?.toLowerCase().includes(q) || r.partner_name?.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || r.restaurant_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <AnimatePresence>
        {successResult && (
          <SuccessBanner
            partner={successResult.partner}
            restaurant={successResult.restaurant}
            tables={successResult.tables}
            loginInstruction={successResult.loginInstruction}
            onDismiss={() => setSuccessResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            placeholder="Search restaurants, zones, partners…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
          />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(["all", "partner", "own"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition ${typeFilter === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
        >
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => setShowOnboard(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          Onboard Restaurant
        </button>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Restaurants", value: restaurants.length },
            { label: "Partner Restaurants", value: restaurants.filter(r => r.restaurant_type === "partner").length },
            { label: "Active", value: restaurants.filter(r => r.is_active).length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 border border-white/8 rounded-xl p-4">
              <div className="text-2xl font-black text-white">{value}</div>
              <div className="text-xs text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center text-white/30 py-16">Loading restaurants…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-white/30 py-16">
          {restaurants.length === 0 ? "No restaurants yet. Onboard your first!" : "No results for your search."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <RestaurantCard key={r.id} restaurant={r} onClick={() => setSelected(r)} />
          ))}
        </div>
      )}

      {/* Drawers */}
      <AnimatePresence>
        {showOnboard && (
          <OnboardDrawer
            zones={zones}
            onClose={() => setShowOnboard(false)}
            onSuccess={handleOnboardSuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <RestaurantDetailDrawer
            restaurant={selected}
            onClose={() => setSelected(null)}
            onUpdated={() => { load(); setSelected(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
