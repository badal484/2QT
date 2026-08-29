"use client";

// Phase 7 (SaaS migration) — platform-admin view of the new SaaS restaurant tenant model
// (restaurants / restaurant_users / outlets / kitchens.restaurant_id, introduced in Phase 3).
//
// This is NOT the "Restaurants" tab elsewhere in this admin panel — that tab manages the
// existing, unrelated dine-in table-booking system (restaurant_config). To avoid any confusion
// between the two, this tab is deliberately labeled "Tenants" and calls a distinctly-named
// backend path (/admin/tenant-restaurants, not /admin/restaurants).
//
// Mostly read-only: this view exists so a platform admin can inspect a restaurant tenant's
// profile, outlets, kitchens, staff, and order/menu summary — it does not duplicate or replace
// any existing management action (kitchen creation/staff assignment stay usable from the
// Kitchens tab too, order operations stay on Dispatch/Orders).
//
// Phase 9: every restaurant has a Delivery Model. 'platform_fleet' (the default, and every
// restaurant that predates this phase) rides the platform's own shared, zone-pooled riders —
// riders stay hidden here for that model, same reasoning as before. 'dedicated_fleet' is an
// explicit admin promotion for a SaaS tenant that runs its own isolated riders (see migration
// 152 and services/autoAssign.ts) — only then do this tenant's own riders (users.restaurant_id)
// appear below, since only then does that ownership actually exist.
//
// The one write action this tab does own is onboarding (Phase 10's NewRestaurantWizard) — it
// exists here, not on Kitchens, because creating a kitchen has always silently created a tenant
// as a side effect (see utils/tenant.ts's createRestaurantTenantForKitchen); putting the guided
// flow where the tenant actually lives makes that relationship visible instead of hidden.

import { useState, useEffect, useCallback } from "react";
import { X, Store, Users, ClipboardList, UtensilsCrossed, Building2, CreditCard, Plus, Bike } from "lucide-react";
import { SkeletonList } from "../components/ui/Skeleton";
import { api } from "../lib/api";
import { toast } from "sonner";
import { NewRestaurantWizard } from "./NewRestaurantWizard";

const fmt = (paise: number | string) => `₹${(parseInt(String(paise || 0)) / 100).toLocaleString("en-IN")}`;

function StatusPill({ status }: { status: string }) {
  const color = status === "active" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400 bg-white/5";
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${color}`}>{status}</span>;
}

// Phase 8 (SaaS migration) — platform-admin billing for a restaurant tenant's 2QT subscription.
// Deliberately admin-only for this phase: no restaurant-side "owner" role exists anywhere in the
// membership model (restaurant_users.role is free-text and every dashboard role is treated
// identically), so there is no safe self-service surface to build yet. See the Phase 8 report.
function SubscriptionSection({ restaurantId, subscriptions, onChanged }: { restaurantId: string; subscriptions: any[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [amountRupees, setAmountRupees] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const inForce = subscriptions.find((s) => s.status === "pending" || s.status === "active");

  const startSubscription = async () => {
    const amountPaise = Math.round(parseFloat(amountRupees) * 100);
    if (!amountPaise || amountPaise <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/tenant-restaurants/${restaurantId}/subscription`, {
        amountPaise,
        billingPeriodStart: new Date(startDate).toISOString(),
        billingPeriodEnd: new Date(endDate).toISOString(),
      });
      toast.success("Subscription created — a Razorpay order was generated for this cycle");
      setShowForm(false);
      setAmountRupees("");
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to create subscription");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSubscription = async () => {
    if (!confirm("Cancel this restaurant's subscription?")) return;
    try {
      await api.post(`/admin/tenant-restaurants/${restaurantId}/subscription/cancel`, {});
      toast.success("Subscription cancelled");
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel subscription");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <CreditCard className="w-3 h-3" /> Subscription Billing
        </div>
        {!inForce && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-[10px] font-black uppercase text-brand-primary hover:underline">
            Start Subscription
          </button>
        )}
        {inForce && (
          <button onClick={cancelSubscription} className="text-[10px] font-black uppercase text-red-400 hover:underline">
            Cancel Subscription
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 mb-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase text-zinc-500">Amount (₹)</label>
              <input type="number" min="1" value={amountRupees} onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full mt-1 bg-[#11111a] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-zinc-500">Period Start</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full mt-1 bg-[#11111a] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-zinc-500">Period End</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full mt-1 bg-[#11111a] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startSubscription} disabled={submitting}
              className="text-xs font-black uppercase px-3 py-1.5 rounded-lg bg-brand-primary text-black disabled:opacity-50">
              {submitting ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs font-black uppercase px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-white/5">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {subscriptions.length === 0 ? (
          <div className="text-xs text-zinc-500">No subscription history</div>
        ) : (
          subscriptions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between bg-[#11111a] border border-white/10 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm text-white">{fmt(s.amount_paise)}</span>
                <span className="text-xs text-zinc-500 ml-2">
                  {new Date(s.billing_period_start).toLocaleDateString()} – {new Date(s.billing_period_end).toLocaleDateString()}
                </span>
              </div>
              <StatusPill status={s.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Phase 9: the explicit admin control that promotes/demotes a tenant between the shared
// platform fleet and its own dedicated riders. Deliberately a confirm-gated toggle, not a plain
// dropdown — flipping this changes which riders can pick up this tenant's orders immediately.
function DeliveryModelToggle({ restaurantId, deliveryModel, onChanged }: { restaurantId: string; deliveryModel: string; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const isDedicated = deliveryModel === "dedicated_fleet";

  const toggle = async () => {
    const next = isDedicated ? "platform_fleet" : "dedicated_fleet";
    const confirmMsg = isDedicated
      ? "Switch back to the shared platform fleet? This tenant's own riders will no longer be eligible for their orders — the platform's shared riders will be used instead."
      : "Give this tenant its own dedicated fleet? Their orders will only be offered to their own riders, never the shared platform pool. Make sure they have riders added first.";
    if (!confirm(confirmMsg)) return;
    setSaving(true);
    try {
      await api.patch(`/admin/tenant-restaurants/${restaurantId}/delivery-model`, { delivery_model: next });
      toast.success(next === "dedicated_fleet" ? "Switched to dedicated fleet" : "Switched to shared platform fleet");
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to update delivery model");
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase transition-colors disabled:opacity-50 ${
        isDedicated ? "text-sky-400 bg-sky-500/10 hover:bg-sky-500/20" : "text-zinc-400 bg-white/5 hover:bg-white/10"
      }`}
      title="Click to switch delivery model"
    >
      {saving ? "…" : isDedicated ? "Dedicated Fleet" : "Platform Fleet"}
    </button>
  );
}

function DetailPanel({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/tenant-restaurants/${restaurantId}`)
      .then(setData)
      .catch((err: any) => toast.error(err.message || "Failed to load restaurant"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-[#0b0b13] border border-white/10 rounded-2xl p-6 mb-8 relative">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/[0.05] rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
        <X className="w-4 h-4" />
      </button>

      {loading || !data ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Platform view — Restaurant Tenant</div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-white">{data.restaurant.name}</h3>
              <StatusPill status={data.restaurant.status} />
              <DeliveryModelToggle restaurantId={restaurantId} deliveryModel={data.restaurant.delivery_model} onChanged={load} />
            </div>
            <div className="text-xs font-mono text-zinc-500 mt-1">{data.restaurant.slug}</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Orders (total)</div>
              <div className="text-xl font-black text-white mt-1">{data.orders.total}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Active Orders</div>
              <div className="text-xl font-black text-white mt-1">{data.orders.active}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Menu Items</div>
              <div className="text-xl font-black text-white mt-1">{data.menu.itemCount}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Staff</div>
              <div className="text-xl font-black text-white mt-1">{data.staff.length}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Outlets ({data.outlets.length})
              </div>
              <div className="space-y-1.5">
                {data.outlets.length === 0
                  ? <div className="text-xs text-zinc-500">No outlets yet</div>
                  : data.outlets.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between bg-[#11111a] border border-white/10 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{o.name}</span>
                      <StatusPill status={o.status} />
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                <Store className="w-3 h-3" /> Kitchens ({data.kitchens.length})
              </div>
              <div className="space-y-1.5">
                {data.kitchens.length === 0
                  ? <div className="text-xs text-zinc-500">No kitchens yet</div>
                  : data.kitchens.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between bg-[#11111a] border border-white/10 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{k.name}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${k.is_paused ? "text-amber-400 bg-amber-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                        {k.is_paused ? "Paused" : "Live"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Staff ({data.staff.length})
            </div>
            <div className="space-y-1.5">
              {data.staff.length === 0
                ? <div className="text-xs text-zinc-500">No staff yet</div>
                : data.staff.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between bg-[#11111a] border border-white/10 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{s.name}</span>
                      <span className="text-xs text-zinc-500 font-mono ml-2">{s.phone}</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase text-brand-primary bg-brand-primary/10">{s.membership_role}</span>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3 h-3" /> Recent Orders
            </div>
            <div className="space-y-1.5">
              {data.orders.recent.length === 0
                ? <div className="text-xs text-zinc-500">No orders yet</div>
                : data.orders.recent.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between bg-[#11111a] border border-white/10 rounded-lg px-3 py-2">
                    <span className="text-xs font-mono text-zinc-400">#{o.display_id}</span>
                    <span className="text-xs text-zinc-400 capitalize">{o.status.replace(/_/g, " ")}</span>
                    <span className="text-sm font-bold text-white">{fmt(o.total_amount_paise)}</span>
                  </div>
                ))}
            </div>
          </div>

          {data.restaurant.delivery_model === "dedicated_fleet" ? (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                <Bike className="w-3 h-3" /> Dedicated Riders ({data.riders?.length ?? 0})
              </div>
              <div className="space-y-1.5">
                {!data.riders || data.riders.length === 0 ? (
                  <div className="text-xs text-zinc-500">No riders added yet — the tenant adds their own from their restaurant dashboard's Staff section.</div>
                ) : (
                  data.riders.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between bg-[#11111a] border border-white/10 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm text-white">{r.name}</span>
                        <span className="text-xs text-zinc-500 font-mono ml-2">{r.phone}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${r.is_online ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400 bg-white/5"}`}>
                        {r.is_online ? "Online" : "Offline"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="text-[10px] text-zinc-500 mt-2">
                Orders from this tenant are only offered to these riders — never the shared platform pool.
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-zinc-500 border-t border-white/[0.06] pt-3">
              This tenant uses the platform's shared, zone-pooled riders — same as every kitchen on 2QT. Switch to Dedicated Fleet above to give them their own isolated riders instead.
            </div>
          )}

          <SubscriptionSection restaurantId={restaurantId} subscriptions={data.subscriptions ?? []} onChanged={load} />
        </div>
      )}
    </div>
  );
}

export function TenantRestaurantsTab() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/admin/tenant-restaurants");
      setRestaurants(data.restaurants ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const [showWizard, setShowWizard] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Tenants</h2>
          <p className="text-xs text-zinc-500 mt-1">Platform-wide view of the SaaS restaurant tenant model — separate from the dine-in Restaurants tab.</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 bg-brand-primary text-black text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New Restaurant
        </button>
      </div>

      {showWizard && (
        <NewRestaurantWizard onClose={() => setShowWizard(false)} onCreated={load} />
      )}

      {selectedId && <DetailPanel restaurantId={selectedId} onClose={() => setSelectedId(null)} />}

      {loading ? (
        <SkeletonList rows={3} />
      ) : restaurants.length === 0 ? (
        <div className="text-sm text-zinc-500">No restaurant tenants yet.</div>
      ) : (
        <div className="bg-[#0b0b13] border border-white/10 rounded-2xl overflow-hidden">
          {restaurants.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03] transition-colors text-left"
            >
              <div>
                <div className="text-sm font-bold text-white">{r.name}</div>
                <div className="text-xs font-mono text-zinc-500 mt-0.5">{r.slug}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-400">{r.outlet_count} outlet{r.outlet_count === 1 ? "" : "s"} · {r.kitchen_count} kitchen{r.kitchen_count === 1 ? "" : "s"}</span>
                {r.subscription_status ? (
                  <StatusPill status={r.subscription_status} />
                ) : (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase text-zinc-500 bg-white/5">No billing</span>
                )}
                <StatusPill status={r.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
