"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Store, X, Edit3,
  ChevronRight, MapPin, Utensils,
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const pct = (r: number | string) => `${(parseFloat(String(r)) * 100).toFixed(0)}%`;
const fmt = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

const STATUS_STYLE: Record<string, string> = {
  new:       "bg-yellow-400/10 text-yellow-400",
  reviewing: "bg-blue-400/10 text-blue-400",
  approved:  "bg-emerald-400/10 text-emerald-400",
  rejected:  "bg-red-400/10 text-red-400",
};

// ─── Review Modal (approve / reject / reviewing) ──────────────────────────────

function ReviewModal({ app, onClose, onApproved, onStatusChange }: {
  app: any; onClose: () => void;
  onApproved: (kitchenId: string, app: any) => void;
  onStatusChange: () => void;
}) {
  const [action, setAction] = useState<"reviewing" | "approved" | "rejected">("reviewing");
  const [rejReason, setRejReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      const res = await api.patch(`/admin/partners/applications/${app.id}`, {
        status: action, rejectionReason: rejReason || undefined, notes: notes || undefined,
      });
      if (action === "approved" && res.kitchen_id) {
        toast.success("Application approved — configure the kitchen");
        onApproved(res.kitchen_id, app);
      } else {
        toast.success("Application updated");
        onStatusChange();
        onClose();
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#0f0f1c] border border-white/10 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Review Application</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Application summary */}
        <div className="bg-white/5 rounded-xl p-4 space-y-1.5">
          <div className="text-lg font-black text-white">{app.restaurant_name}</div>
          <div className="text-sm text-white/60">{app.owner_name} · {app.phone}</div>
          {app.email && <div className="text-xs text-white/40">{app.email}</div>}
          <div className="text-xs text-white/30">{app.address}, {app.city}</div>
          {app.cuisine_type && <div className="text-xs text-white/40">Cuisine: {app.cuisine_type}</div>}
          {app.fssai_number && <div className="text-xs text-white/40 font-mono">FSSAI: {app.fssai_number}</div>}
          {app.upi_id && <div className="text-xs text-white/40 font-mono">UPI: {app.upi_id}</div>}
          {app.expected_daily_orders && <div className="text-xs text-white/40">Expected: {app.expected_daily_orders} orders/day</div>}
        </div>

        {/* Action selector */}
        <div>
          <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Decision</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(["reviewing", "approved", "rejected"] as const).map(s => (
              <button key={s} onClick={() => setAction(s)}
                className={`py-2.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                  action === s
                    ? s === "approved" ? "bg-emerald-500 text-white" : s === "rejected" ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                }`}>
                {s === "approved" ? "✓ Approve" : s === "rejected" ? "✗ Reject" : "👁 Review"}
              </button>
            ))}
          </div>
          {action === "approved" && (
            <p className="text-xs text-emerald-400/70 mt-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              Next: Configure zone, hours & menu — then go live
            </p>
          )}
        </div>

        {action === "rejected" && (
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Rejection Reason</label>
            <input value={rejReason} onChange={e => setRejReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50 placeholder:text-white/20" />
          </div>
        )}

        <div>
          <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Internal Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Notes for the team..."
            className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20 resize-none" />
        </div>

        <button onClick={confirm} disabled={loading}
          className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-black text-sm hover:bg-purple-400 transition-colors disabled:opacity-50">
          {loading ? "Saving..." : action === "approved" ? "Approve & Configure Kitchen →" : "Save"}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Setup Drawer (zone + hours + commission + go-live) ───────────────────────

function SetupDrawer({ kitchen, zones, onSave, onClose }: {
  kitchen: any; zones: any[]; onSave: () => void; onClose: () => void;
}) {
  const [name, setName]               = useState(kitchen.name || "");
  const [contactPhone, setPhone]      = useState(kitchen.contact_phone || "");
  const [contactEmail, setEmail]      = useState(kitchen.contact_email || "");
  const [zoneId, setZoneId]           = useState(kitchen.zone?.id || "");
  const [openTime, setOpenTime]       = useState(kitchen.opening_time || "10:00");
  const [closeTime, setCloseTime]     = useState(kitchen.closing_time || "22:00");
  const [commission, setCommission]   = useState(String(Math.round(parseFloat(kitchen.commission_rate || "0.20") * 100)));
  const [upiId, setUpiId]             = useState(kitchen.upi_id || "");
  const [isActive, setIsActive]       = useState<boolean>(!!kitchen.is_active);
  const [partnerStatus, setPartnerStatus] = useState<string>(kitchen.partner_status || 'approved');
  const [loading, setLoading]         = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Kitchen name required");
    if (!zoneId) return toast.error("Please assign a zone");
    const commRate = parseFloat(commission) / 100;
    if (isNaN(commRate) || commRate < 0 || commRate > 1) return toast.error("Commission must be 0–100%");
    setLoading(true);
    try {
      await api.patch(`/admin/partners/kitchens/${kitchen.id}`, {
        name: name.trim(), commissionRate: commRate, upiId: upiId.trim() || undefined,
        zoneId, openingTime: openTime, closingTime: closeTime,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        isActive, partnerStatus,
      });
      toast.success(isActive ? "Kitchen is now LIVE!" : "Kitchen configured (not live yet)");
      onSave();
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="w-full sm:max-w-md h-full bg-[#0f0f1c] border-l border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-lg font-black text-white">Configure Kitchen</h3>
            <p className="text-xs text-white/40 mt-0.5">Set up zone, hours & go-live</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Name */}
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Kitchen Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50" />
          </div>

          {/* Zone */}
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Delivery Zone
            </label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 appearance-none">
              <option value="">— Select zone —</option>
              {zones.map((z: any) => (
                <option key={z.id} value={z.id}>{z.name} {z.city ? `· ${z.city}` : ""}</option>
              ))}
            </select>
            <p className="text-xs text-white/30 mt-1.5">Same zone system as other kitchens — zone controls delivery radius</p>
          </div>

          {/* Hours */}
          <div>
            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Utensils className="w-3 h-3" /> Operating Hours
            </label>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1">
                <p className="text-xs text-white/30 mb-1">Opens</p>
                <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50" />
              </div>
              <div className="text-white/20 text-sm pt-5">→</div>
              <div className="flex-1">
                <p className="text-xs text-white/30 mb-1">Closes</p>
                <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50" />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Contact Phone</label>
              <input value={contactPhone} onChange={e => setPhone(e.target.value)} placeholder="+91..."
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Contact Email</label>
              <input value={contactEmail} onChange={e => setEmail(e.target.value)} placeholder="owner@..."
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20" />
            </div>
          </div>

          {/* Commission + UPI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">Commission %</label>
              <div className="relative mt-2">
                <input type="number" min="0" max="100" step="1" value={commission} onChange={e => setCommission(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-8 text-sm text-white outline-none focus:border-purple-500/50" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/30">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider">UPI for Payouts</label>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="name@upi"
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-white/20" />
            </div>
          </div>

          {/* Go-live toggle */}
          <div className={`rounded-2xl p-4 border transition-colors ${isActive ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-bold text-sm ${isActive ? "text-emerald-400" : "text-white/60"}`}>
                  {isActive ? "🟢 Kitchen is LIVE" : "⚪ Not Live Yet"}
                </div>
                <div className="text-xs text-white/30 mt-0.5">
                  {isActive ? "Customers can see & order from this kitchen" : "Enable when zone and menu are ready"}
                </div>
              </div>
              <button onClick={() => setIsActive(!isActive)}
                className={`w-12 h-6 rounded-full transition-colors relative ${isActive ? "bg-emerald-500" : "bg-white/10"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isActive ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </div>

          {/* Suspend / Unsuspend */}
          <div className={`rounded-2xl p-4 border transition-colors ${partnerStatus === 'suspended' ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-bold text-sm ${partnerStatus === 'suspended' ? "text-red-400" : "text-white/60"}`}>
                  {partnerStatus === 'suspended' ? "🔴 Partner Suspended" : "✅ Partner Active"}
                </div>
                <div className="text-xs text-white/30 mt-0.5">
                  {partnerStatus === 'suspended'
                    ? "Orders blocked — kitchen cannot accept new orders"
                    : "Partner can receive orders normally"}
                </div>
              </div>
              <button
                onClick={() => setPartnerStatus(s => s === 'suspended' ? 'approved' : 'suspended')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  partnerStatus === 'suspended'
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                }`}
              >
                {partnerStatus === 'suspended' ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>

          {/* Menu note */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-400/80 font-semibold">Menu Setup</p>
            <p className="text-xs text-white/40 mt-1">
              Add menu items via <span className="text-white/60 font-mono">Admin → Menu</span> tab — filter by this kitchen name.
              Menu must be added before going live.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button onClick={save} disabled={loading}
            className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-black text-sm hover:bg-purple-400 transition-colors disabled:opacity-50">
            {loading ? "Saving..." : isActive ? "Save & Go Live" : "Save Configuration"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main PartnersTab ─────────────────────────────────────────────────────────

export function PartnersTab() {
  const [view, setView]               = useState<"applications" | "kitchens">("applications");
  const [appStatus, setAppStatus]     = useState<"new" | "reviewing" | "approved" | "rejected">("new");
  const [applications, setApplications] = useState<any[]>([]);
  const [kitchens, setKitchens]       = useState<any[]>([]);
  const [zones, setZones]             = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [reviewing, setReviewing]     = useState<any>(null);   // application being reviewed
  const [setupKitchen, setSetupKitchen] = useState<any>(null); // kitchen being set up

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "applications") {
        const res = await api.get(`/admin/partners/applications?status=${appStatus}`);
        setApplications(res.applications || []);
      } else {
        const res = await api.get("/admin/partners/kitchens");
        setKitchens(res.kitchens || []);
      }
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view, appStatus]);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["partner_updated"], load);

  // Fetch zones once
  useEffect(() => {
    api.get("/admin/zones").then(r => setZones(r.zones || [])).catch(() => {});
  }, []);

  // Called when admin approves — backend creates kitchen, we open setup drawer
  const handleApproved = async (kitchenId: string, app: any) => {
    setReviewing(null);
    // Fetch the freshly-created kitchen record
    try {
      const res = await api.get("/admin/partners/kitchens");
      const created = (res.kitchens || []).find((k: any) => k.id === kitchenId);
      if (created) {
        setSetupKitchen(created);
      } else {
        // Fallback: build a minimal object from the application
        setSetupKitchen({
          id: kitchenId, name: app.restaurant_name, contact_phone: app.phone,
          contact_email: app.email, upi_id: app.upi_id, commission_rate: "0.20",
          opening_time: "10:00", closing_time: "22:00", is_active: false, zone: null,
        });
      }
    } catch {
      toast.error("Kitchen created — reload to configure it");
    }
    await load();
  };

  const handleSetupSave = () => { load(); };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Kitchen Partners</h2>
          <p className="text-white/40 text-sm mt-0.5">Applications · configure zone, hours & go-live</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {(["applications", "kitchens"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              view === v ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}>
            {v === "kitchens" ? "Active Partners" : "Applications"}
          </button>
        ))}
      </div>

      {/* Application status filter */}
      {view === "applications" && (
        <div className="flex gap-2 flex-wrap">
          {(["new", "reviewing", "approved", "rejected"] as const).map(s => (
            <button key={s} onClick={() => setAppStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                appStatus === s ? STATUS_STYLE[s] : "bg-white/5 text-white/30 hover:text-white/60"
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : view === "applications" ? (
        applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Store className="w-10 h-10 text-white/10" />
            <p className="text-white/30 text-sm">No {appStatus} applications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((a: any) => (
              <div key={a.id} className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white">{a.restaurant_name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                      {a.kitchen_id && <span className="text-xs text-emerald-400/60 font-mono">Kitchen created</span>}
                    </div>
                    <div className="text-sm text-white/50">{a.owner_name} · {a.phone}</div>
                    <div className="text-xs text-white/30">{a.city}{a.cuisine_type ? ` · ${a.cuisine_type}` : ""}</div>
                    <div className="text-xs text-white/20">{new Date(a.created_at).toLocaleDateString("en-IN")}</div>
                    {a.notes && <div className="text-xs text-white/40 italic">{a.notes}</div>}
                    {a.rejection_reason && <div className="text-xs text-red-400">{a.rejection_reason}</div>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {(a.status === "new" || a.status === "reviewing") && (
                      <button onClick={() => setReviewing(a)}
                        className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-400 transition-colors">
                        Review
                      </button>
                    )}
                    {a.status === "approved" && a.kitchen_id && (
                      <button onClick={async () => {
                        const res = await api.get("/admin/partners/kitchens");
                        const k = (res.kitchens || []).find((k: any) => k.id === a.kitchen_id);
                        if (k) setSetupKitchen(k);
                      }}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors">
                        Configure
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Active Partners */
        kitchens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Store className="w-10 h-10 text-white/10" />
            <p className="text-white/30 text-sm">No partner kitchens yet. Approve an application first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {kitchens.map((k: any) => (
              <div key={k.id} className={`bg-[#0d0d1a] border rounded-2xl p-4 transition-colors ${
                k.is_active ? "border-emerald-500/20" : "border-white/[0.07]"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white">{k.name}</span>
                      {k.is_active
                        ? <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">LIVE</span>
                        : <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/30">Not Live</span>
                      }
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400">
                        {pct(k.commission_rate)} commission
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                      {k.zone
                        ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{k.zone.name}</span>
                        : <span className="text-amber-400/60">⚠ No zone assigned</span>
                      }
                      {k.opening_time && <span>🕐 {k.opening_time} – {k.closing_time}</span>}
                    </div>
                    <div className="text-xs text-white/20 font-mono">
                      Lifetime payout: {fmt(parseInt(k.lifetime_payout_paise))}
                      {k.upi_id && <span className="ml-3">UPI: {k.upi_id}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSetupKitchen(k)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors flex-shrink-0">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modals */}
      <AnimatePresence>
        {reviewing && (
          <ReviewModal
            key="review"
            app={reviewing}
            onClose={() => setReviewing(null)}
            onApproved={handleApproved}
            onStatusChange={load}
          />
        )}
        {setupKitchen && (
          <SetupDrawer
            key="setup"
            kitchen={setupKitchen}
            zones={zones}
            onSave={handleSetupSave}
            onClose={() => setSetupKitchen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
