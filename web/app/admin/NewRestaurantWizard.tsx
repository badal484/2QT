"use client";

// Phase 10 (SaaS migration) — guided onboarding wizard for the Tenants tab.
//
// Deliberately a frontend-only orchestrator: every step below calls an existing, already-
// authorized backend endpoint in sequence (POST /admin/kitchens auto-creates the restaurant
// tenant as a side effect — see utils/tenant.ts's createRestaurantTenantForKitchen — then
// staff assignment, then optional billing). There is no new combined backend endpoint, so each
// step keeps its own existing validation/authorization, and a failure partway through leaves a
// recoverable state (e.g. the kitchen exists, you just finish staffing it from the Kitchens tab)
// rather than needing an all-or-nothing transaction.
//
// No "restaurant owner" concept: the staff step's role dropdown is the same one every staff
// member gets, first or fifth — nothing here grants special standing to whoever is added first.
//
// Zone creation is intentionally NOT embedded here — a new zone requires drawing a delivery
// polygon on a map (see ZonesTab.tsx), a real map-drawing widget this modal does not duplicate.
// This step only lets you pick an existing zone.

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Check, Store, MapPin, UtensilsCrossed, Users, CreditCard, ClipboardCheck } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "chef", label: "Chef" },
  { value: "kitchen_manager", label: "Kitchen Manager" },
  { value: "packer", label: "Packer" },
  { value: "partner_kitchen", label: "Partner (Kitchen Owner)" },
];

const STEPS = [
  { key: "business", label: "Business", icon: Store },
  { key: "zone", label: "Zone", icon: MapPin },
  { key: "kitchen", label: "Kitchen", icon: UtensilsCrossed },
  { key: "staff", label: "Staff", icon: Users },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "review", label: "Review", icon: ClipboardCheck },
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-[#11111a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/50";

export function NewRestaurantWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);

  const [restaurantName, setRestaurantName] = useState("");
  const [kitchenNameOverride, setKitchenNameOverride] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [fssai, setFssai] = useState("");
  const [gstin, setGstin] = useState("");

  // Kitchens created through paths that pre-date the tenant model (e.g. partner approvals
  // before the fix in dbb27e5) can be sitting without a restaurant tenant — offering to attach
  // one here, instead of always creating a brand-new kitchen, is a self-service fix for that
  // without needing a database backfill.
  const [kitchenMode, setKitchenMode] = useState<"new" | "existing">("new");
  const [orphanKitchens, setOrphanKitchens] = useState<any[]>([]);
  const [orphanKitchensLoading, setOrphanKitchensLoading] = useState(true);
  const [existingKitchenId, setExistingKitchenId] = useState("");

  const [addStaff, setAddStaff] = useState(true);
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRole, setStaffRole] = useState("chef");

  const [startBilling, setStartBilling] = useState(false);
  const [amountRupees, setAmountRupees] = useState("");
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));

  const kitchenName = kitchenNameOverride ?? restaurantName;

  useEffect(() => {
    api.get("/admin/zones")
      .then((data: any) => setZones(data.zones ?? data ?? []))
      .catch(() => toast.error("Failed to load zones"))
      .finally(() => setZonesLoading(false));
    api.get("/admin/kitchens")
      .then((data: any) => {
        const orphans = (data.kitchens ?? []).filter((k: any) => !k.restaurant_id);
        setOrphanKitchens(orphans);
        if (orphans.length === 0) setKitchenMode("new"); // nothing to attach to — default straight to creating new
      })
      .catch(() => {}) // non-fatal — "create new" still works if this fails
      .finally(() => setOrphanKitchensLoading(false));
  }, []);

  const step = STEPS[stepIdx];

  const canAdvance = (() => {
    switch (step.key) {
      case "business": return restaurantName.trim().length > 0;
      case "zone": return !!zoneId;
      case "kitchen": return kitchenMode === "existing" ? !!existingKitchenId : (address.trim().length > 0 && kitchenName.trim().length > 0);
      case "staff": return !addStaff || (staffName.trim() && /^\d{10}$/.test(staffPhone.replace(/\D/g, "")));
      case "billing": return !startBilling || (parseFloat(amountRupees) > 0 && periodEnd > periodStart);
      default: return true;
    }
  })();

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const create = async () => {
    setCreating(true);
    try {
      let kitchenId: string;
      let restaurantId: string;

      if (kitchenMode === "existing") {
        const attachRes = await api.post(`/admin/kitchens/${existingKitchenId}/tenant`, {
          restaurant_name: restaurantName,
          zone_id: zoneId,
        });
        kitchenId = existingKitchenId;
        restaurantId = attachRes.restaurant_id;
      } else {
        const kitchenRes = await api.post("/admin/kitchens", {
          name: kitchenName,
          restaurant_name: restaurantName,
          zone_ids: [zoneId],
          address,
          fssai_license: fssai || undefined,
          gstin: gstin || undefined,
        });
        const kitchen = kitchenRes.kitchen ?? kitchenRes;
        kitchenId = kitchen.id;
        restaurantId = kitchen.restaurant_id;
      }

      if (addStaff && staffName.trim()) {
        try {
          await api.post(`/admin/kitchens/${kitchenId}/staff`, {
            name: staffName.trim(),
            phone: staffPhone.replace(/\D/g, ""),
            role: staffRole,
          });
        } catch (err: any) {
          toast.error(`Restaurant created, but adding staff failed: ${err.message || "unknown error"} — add them from the Kitchens tab.`);
        }
      }

      if (startBilling && restaurantId) {
        try {
          await api.post(`/admin/tenant-restaurants/${restaurantId}/subscription`, {
            amountPaise: Math.round(parseFloat(amountRupees) * 100),
            billingPeriodStart: new Date(periodStart).toISOString(),
            billingPeriodEnd: new Date(periodEnd).toISOString(),
          });
        } catch (err: any) {
          toast.error(`Restaurant created, but starting billing failed: ${err.message || "unknown error"} — start it from the Tenants tab.`);
        }
      }

      toast.success(`${restaurantName} is onboarded`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create the restaurant — nothing was saved for this step.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0b0b13] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="text-lg font-bold text-white">New Restaurant</h3>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 pt-4">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`flex-1 h-1 rounded-full ${i <= stepIdx ? "bg-brand-primary" : "bg-white/[0.06]"}`} />
          ))}
        </div>
        <div className="px-5 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Step {stepIdx + 1} of {STEPS.length} — {step.label}
        </div>

        <div className="p-5 space-y-4">
          {step.key === "business" && (
            <Field label="Restaurant Name">
              <input autoFocus className={inputClass} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="e.g. Punjabi Dhaba" />
              <p className="text-[10px] text-zinc-500 mt-1.5">This is the business's public/billing identity — you can give the kitchen a different operational name in a later step.</p>
            </Field>
          )}

          {step.key === "zone" && (
            <Field label="Delivery Zone">
              {zonesLoading ? (
                <div className="text-xs text-zinc-500">Loading zones…</div>
              ) : zones.length === 0 ? (
                <div className="text-xs text-zinc-500">No zones exist yet — create one from the Zones tab first, then come back here.</div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {zones.map((z: any) => (
                    <label key={z.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${zoneId === z.id ? "bg-brand-primary/10 border-brand-primary/50 text-brand-primary" : "bg-[#11111a] border-white/10 text-white hover:bg-white/5"}`}>
                      <input type="radio" name="zone" className="hidden" checked={zoneId === z.id} onChange={() => setZoneId(z.id)} />
                      <span className="text-sm font-semibold">{z.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-zinc-500 mt-1.5">Need a new area? Zones require drawing a delivery boundary on a map — create it from the Zones tab, then restart this wizard.</p>
            </Field>
          )}

          {step.key === "kitchen" && (
            <div className="space-y-4">
              {!orphanKitchensLoading && orphanKitchens.length > 0 && (
                <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl">
                  <button onClick={() => setKitchenMode("new")}
                    className={`flex-1 text-xs font-black uppercase tracking-widest py-2 rounded-lg transition-colors ${kitchenMode === "new" ? "bg-brand-primary text-black" : "text-zinc-400 hover:text-white"}`}>
                    Create New Kitchen
                  </button>
                  <button onClick={() => setKitchenMode("existing")}
                    className={`flex-1 text-xs font-black uppercase tracking-widest py-2 rounded-lg transition-colors ${kitchenMode === "existing" ? "bg-brand-primary text-black" : "text-zinc-400 hover:text-white"}`}>
                    Use Existing Kitchen
                  </button>
                </div>
              )}

              {kitchenMode === "existing" ? (
                <Field label="Kitchen (without a tenant yet)">
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {orphanKitchens.map((k: any) => (
                      <label key={k.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${existingKitchenId === k.id ? "bg-brand-primary/10 border-brand-primary/50 text-brand-primary" : "bg-[#11111a] border-white/10 text-white hover:bg-white/5"}`}>
                        <input type="radio" name="existing-kitchen" className="hidden" checked={existingKitchenId === k.id} onChange={() => setExistingKitchenId(k.id)} />
                        <div>
                          <div className="text-sm font-semibold">{k.name}</div>
                          <div className="text-[10px] text-zinc-500">{k.address || "No address on file"}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1.5">These kitchens exist but were never registered as a billable tenant — often from an approval flow that pre-dates this system.</p>
                </Field>
              ) : (
                <>
                  <Field label="Kitchen Name">
                    <input className={inputClass} value={kitchenName} onChange={(e) => setKitchenNameOverride(e.target.value)} placeholder={restaurantName} />
                    <p className="text-[10px] text-zinc-500 mt-1.5">Defaults to the restaurant name — edit if the operational kitchen name should differ (e.g. "{restaurantName} — HSR Layout").</p>
                  </Field>
                  <Field label="Address">
                    <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="FSSAI License (optional)">
                      <input className={inputClass} value={fssai} onChange={(e) => setFssai(e.target.value)} />
                    </Field>
                    <Field label="GSTIN (optional)">
                      <input className={inputClass} value={gstin} onChange={(e) => setGstin(e.target.value)} />
                    </Field>
                  </div>
                </>
              )}
            </div>
          )}

          {step.key === "staff" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={addStaff} onChange={(e) => setAddStaff(e.target.checked)} className="rounded" />
                Add the first staff member now
              </label>
              {addStaff && (
                <div className="space-y-4 pl-1">
                  <Field label="Name">
                    <input className={inputClass} value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                  </Field>
                  <Field label="Phone (10 digits)">
                    <input className={inputClass} value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)} placeholder="9876543210" />
                  </Field>
                  <Field label="Role">
                    <select className={inputClass} value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <p className="text-[10px] text-zinc-500 mt-1.5">Same role privileges regardless of who's added first — there's no "owner" concept in this system.</p>
                  </Field>
                </div>
              )}
              {!addStaff && <p className="text-xs text-zinc-500">You can add staff later from the Kitchens tab.</p>}
            </div>
          )}

          {step.key === "billing" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={startBilling} onChange={(e) => setStartBilling(e.target.checked)} className="rounded" />
                Start a subscription now
              </label>
              {startBilling && (
                <div className="space-y-4 pl-1">
                  <Field label="Amount (₹)">
                    <input type="number" min="1" className={inputClass} value={amountRupees} onChange={(e) => setAmountRupees(e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Period Start"><input type="date" className={inputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field>
                    <Field label="Period End"><input type="date" className={inputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field>
                  </div>
                </div>
              )}
              {!startBilling && <p className="text-xs text-zinc-500">You can start billing later from the Tenants tab.</p>}
            </div>
          )}

          {step.key === "review" && (
            <div className="space-y-3">
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Restaurant</span><span className="text-white font-semibold">{restaurantName}</span></div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Kitchen</span>
                  <span className="text-white">
                    {kitchenMode === "existing" ? orphanKitchens.find((k) => k.id === existingKitchenId)?.name : kitchenName}
                    {kitchenMode === "existing" && <span className="text-[10px] text-zinc-500 ml-1.5">(existing)</span>}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-zinc-500">Zone</span><span className="text-white">{zones.find((z) => z.id === zoneId)?.name || "—"}</span></div>
                {kitchenMode === "new" && <div className="flex justify-between"><span className="text-zinc-500">Address</span><span className="text-white text-right max-w-[60%]">{address}</span></div>}
                <div className="flex justify-between"><span className="text-zinc-500">First staff</span><span className="text-white">{addStaff ? `${staffName} (${ROLE_OPTIONS.find((r) => r.value === staffRole)?.label})` : "Skipped"}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Billing</span><span className="text-white">{startBilling ? `₹${amountRupees} / cycle` : "Skipped"}</span></div>
              </div>
              <button onClick={create} disabled={creating}
                className="w-full bg-brand-primary text-black font-black uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? "Creating…" : (<><Check className="w-4 h-4" /> Create Restaurant</>)}
              </button>
            </div>
          )}
        </div>

        {step.key !== "review" && (
          <div className="flex items-center justify-between p-5 border-t border-white/[0.06]">
            <button onClick={back} disabled={stepIdx === 0}
              className="flex items-center gap-1 text-xs font-black uppercase text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button onClick={next} disabled={!canAdvance}
              className="flex items-center gap-1 bg-white/[0.06] hover:bg-white/10 disabled:opacity-30 text-white text-xs font-black uppercase px-4 py-2 rounded-xl transition-colors">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
