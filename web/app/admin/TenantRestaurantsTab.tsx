"use client";

// Phase 7 (SaaS migration) — platform-admin view of the new SaaS restaurant tenant model
// (restaurants / restaurant_users / outlets / kitchens.restaurant_id, introduced in Phase 3).
//
// This is NOT the "Restaurants" tab elsewhere in this admin panel — that tab manages the
// existing, unrelated dine-in table-booking system (restaurant_config). To avoid any confusion
// between the two, this tab is deliberately labeled "Tenants" and calls a distinctly-named
// backend path (/admin/tenant-restaurants, not /admin/restaurants).
//
// Read-only: this view exists so a platform admin can inspect a restaurant tenant's profile,
// outlets, kitchens, staff, and order/menu summary — it does not duplicate or replace any
// existing management action (kitchen creation/staff assignment stay on the Kitchens tab, order
// operations stay on Dispatch/Orders). Riders are intentionally never shown here — they remain
// platform-owned and zone-pooled (Phase 6), not restaurant-owned, and showing them on a
// restaurant's page would misleadingly imply an ownership that doesn't exist.

import { useState, useEffect, useCallback } from "react";
import { X, Store, Users, ClipboardList, UtensilsCrossed, Building2 } from "lucide-react";
import { SkeletonList } from "../components/ui/Skeleton";
import { api } from "../lib/api";
import { toast } from "sonner";

const fmt = (paise: number | string) => `₹${(parseInt(String(paise || 0)) / 100).toLocaleString("en-IN")}`;

function StatusPill({ status }: { status: string }) {
  const color = status === "active" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400 bg-white/5";
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${color}`}>{status}</span>;
}

function DetailPanel({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/tenant-restaurants/${restaurantId}`)
      .then(setData)
      .catch((err: any) => toast.error(err.message || "Failed to load restaurant"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

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

          <div className="text-[10px] text-zinc-500 border-t border-white/[0.06] pt-3">
            Riders are platform-owned and zone-pooled — not restaurant-owned — so they intentionally do not appear on this page. See the Fleet tab for platform-wide rider management.
          </div>
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Tenants</h2>
          <p className="text-xs text-zinc-500 mt-1">Platform-wide view of the SaaS restaurant tenant model — separate from the dine-in Restaurants tab.</p>
        </div>
      </div>

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
                <StatusPill status={r.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
