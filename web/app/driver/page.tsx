"use client";

// Dedicated SaaS In-House Store Driver App
// Built specifically for restaurant delivery staff (users.restaurant_id != null).
// Focuses 100% on store shifts, store orders, GPS navigation, and cash-in-hand handover
// without any marketplace gig clutter (no platform wallet, no surge missions).

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike, ChefHat, Navigation, Phone, CheckCircle2, Clock, MapPin,
  LogOut, RefreshCw, Banknote, ShieldCheck, ArrowRight, Store,
  AlertCircle, ChevronRight, Package, UserCheck
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../providers";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

const fmt = (paise: number | string) =>
  `₹${(parseInt(String(paise || 0)) / 100).toLocaleString("en-IN")}`;

export default function DriverPage() {
  const { user, logout, loading: authLoading } = useAuth()!;
  const router = useRouter();

  const [onDuty, setOnDuty] = useState(true);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [storeOrders, setStoreOrders] = useState<any[]>([]);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"deliveries" | "shift" | "store">("deliveries");
  const [otpInput, setOtpInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "rider" && user.role !== "rider_captain" && user.role !== "super_admin") {
      router.replace("/menu");
    }
  }, [user, authLoading, router]);

  // Load orders and shift metrics
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, poolRes, summaryRes] = await Promise.all([
        api.get("/riders/orders/active").catch(() => ({ order: null })),
        api.get("/riders/orders/pool").catch(() => ({ orders: [] })),
        api.get("/riders/shift-summary").catch(() => null),
      ]);

      setActiveOrder(activeRes.order || null);
      setStoreOrders(activeRes.order ? [] : (poolRes.orders || []));
      if (summaryRes) setShiftSummary(summaryRes);
    } catch (err: any) {
      console.error("[DRIVER_DATA]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useSocketRefresh(["new_order", "order_updated", "rider_assigned"], loadData);

  // Toggle on-duty shift status
  const toggleDuty = async () => {
    const next = !onDuty;
    setOnDuty(next);
    try {
      await api.patch("/riders/status", { is_online: next });
      toast.success(next ? "Shift Active — On Duty" : "Shift Paused — Off Duty");
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Claim store order
  const claimOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/riders/orders/${orderId}/accept`);
      toast.success("Order assigned to your shift!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to claim order");
    } finally {
      setActionLoading(false);
    }
  };

  // Pickup order
  const pickupOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/riders/orders/${orderId}/pickup`);
      toast.success("Food picked up! Heading to customer.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm pickup");
    } finally {
      setActionLoading(false);
    }
  };

  // Complete delivery
  const deliverOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/riders/orders/${orderId}/deliver`, {
        otp: otpInput.trim() || undefined,
      });
      toast.success("Delivery completed successfully!");
      setOtpInput("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete delivery. Check OTP if required.");
    } finally {
      setActionLoading(false);
    }
  };

  const openNavigation = (lat?: number, lng?: number, addressText?: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else if (addressText) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans pb-24">
      {/* Top Store Header */}
      <header className="border-b border-white/[0.06] bg-[#0d0d1a] px-5 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white leading-none">
              {shiftSummary?.restaurantName || "Store Delivery"}
            </h1>
            <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1.5">
              <span>Driver: {user?.name || "Staff"}</span>
              <span>·</span>
              <span className="font-mono">{user?.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleDuty}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              onDuty ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onDuty ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
            {onDuty ? "On Duty" : "Off Duty"}
          </button>
          <button
            onClick={loadData}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={logout}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-[#0d0d1a] p-1 rounded-2xl border border-white/[0.06]">
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "deliveries" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/40 hover:text-white"
            }`}
          >
            Deliveries {storeOrders.length > 0 && `(${storeOrders.length})`}
          </button>
          <button
            onClick={() => setActiveTab("shift")}
            className={`py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "shift" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/40 hover:text-white"
            }`}
          >
            Shift & Cash
          </button>
          <button
            onClick={() => setActiveTab("store")}
            className={`py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === "store" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/40 hover:text-white"
            }`}
          >
            Store Manager
          </button>
        </div>

        {/* ─── TAB 1: DELIVERIES ────────────────────────────────────────────── */}
        {activeTab === "deliveries" && (
          <div className="space-y-6">
            {/* Active Delivering Order */}
            {activeOrder ? (
              <div className="bg-[#0d0d1a] border-2 border-orange-500/40 rounded-3xl p-5 space-y-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 px-4 py-1.5 bg-orange-500 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
                  {activeOrder.status === "out_for_delivery" ? "Out for Delivery" : "Ready for Pickup"}
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">Active Delivery</div>
                  <h2 className="text-xl font-bold text-white mt-0.5">Order #{activeOrder.display_id || activeOrder.id.slice(0, 8)}</h2>
                </div>

                {/* Kitchen / Pickup Station */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40 uppercase font-bold text-[10px]">Pickup From</span>
                    <span className="text-orange-400 font-bold">{activeOrder.kitchen_name || shiftSummary?.restaurantName}</span>
                  </div>
                  {activeOrder.kitchen_address && (
                    <div className="text-xs text-white/60 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
                      <span>{activeOrder.kitchen_address}</span>
                    </div>
                  )}
                </div>

                {/* Customer Details & Actions */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{activeOrder.customer_name || "Customer"}</div>
                      <div className="text-xs text-white/40 font-mono mt-0.5">{activeOrder.customer_phone}</div>
                    </div>
                    {activeOrder.customer_phone && (
                      <a
                        href={`tel:${activeOrder.customer_phone}`}
                        className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call Customer
                      </a>
                    )}
                  </div>

                  <div className="text-xs text-white/70 flex items-start gap-1.5 pt-2 border-t border-white/5">
                    <Navigation className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <span>{activeOrder.delivery_address_text || "Customer Address"}</span>
                  </div>

                  <button
                    onClick={() => openNavigation(activeOrder.customer_lat, activeOrder.customer_lng, activeOrder.delivery_address_text)}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5 text-orange-400" /> Open in Google Maps
                  </button>
                </div>

                {/* Items & Payment Info */}
                <div className="flex items-center justify-between px-2 text-xs">
                  <div>
                    <span className="text-white/40">Payment: </span>
                    <span className={`font-bold ${activeOrder.payment_method === 'cod' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {activeOrder.payment_method === 'cod' ? `COD (Collect ${fmt(activeOrder.total_amount_paise)})` : 'Prepaid Online'}
                    </span>
                  </div>
                  <div className="font-bold text-white">
                    {fmt(activeOrder.total_amount_paise)}
                  </div>
                </div>

                {/* Progress Actions */}
                {activeOrder.status === "ready_for_pickup" || activeOrder.status === "ready" ? (
                  <button
                    onClick={() => pickupOrder(activeOrder.id)}
                    disabled={actionLoading}
                    className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 font-black text-sm text-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Bike className="w-4 h-4" /> {actionLoading ? "Confirming…" : "Confirm Food Picked Up"}
                  </button>
                ) : (
                  <div className="space-y-3 pt-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter Delivery OTP (if provided)"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      className="w-full py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 text-center tracking-widest font-mono focus:outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={() => deliverOrder(activeOrder.id)}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-black text-sm text-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {actionLoading ? "Completing…" : "Confirm Order Delivered"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Ready Store Orders Queue */}
            {!activeOrder && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-white/40 uppercase font-black tracking-wider px-1">
                  <span>Store Ready Orders</span>
                  <span>{storeOrders.length} Available</span>
                </div>

                {storeOrders.length === 0 ? (
                  <div className="bg-[#0d0d1a] border border-white/[0.06] rounded-3xl p-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-white/30">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-white">No Orders Waiting</div>
                    <p className="text-xs text-white/40 max-w-xs mx-auto">
                      New orders from {shiftSummary?.restaurantName || "your kitchen"} will appear here as soon as they are ready.
                    </p>
                  </div>
                ) : (
                  storeOrders.map((o) => (
                    <div key={o.id} className="bg-[#0d0d1a] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">Order #{o.display_id || o.id.slice(0, 8)}</div>
                          <div className="text-xs text-white/40">{o.kitchen_name || shiftSummary?.restaurantName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-white">{fmt(o.total_amount_paise)}</div>
                          <span className={`text-[9px] font-bold uppercase ${o.payment_method === 'cod' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {o.payment_method === 'cod' ? 'COD' : 'Prepaid'}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-white/60 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{o.delivery_address_text || "Customer Address"}</span>
                      </div>

                      <button
                        onClick={() => claimOrder(o.id)}
                        disabled={actionLoading || !onDuty}
                        className="w-full py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-30"
                      >
                        Claim & Deliver <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: SHIFT & CASH HANDOVER ─────────────────────────────────── */}
        {activeTab === "shift" && (
          <div className="space-y-6">
            {/* Shift Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d0d1a] border border-white/[0.06] rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Deliveries Today</div>
                <div className="text-3xl font-black text-white mt-1">{shiftSummary?.deliveriesCount ?? 0}</div>
                <div className="text-[10px] text-emerald-400 mt-1">Completed Shift Orders</div>
              </div>

              <div className="bg-[#0d0d1a] border border-white/[0.06] rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Distance Covered</div>
                <div className="text-3xl font-black text-white mt-1">{shiftSummary?.totalDistanceKm ?? 0} <span className="text-sm text-white/40">KM</span></div>
                <div className="text-[10px] text-orange-400 mt-1">Logged for fuel allowance</div>
              </div>
            </div>

            {/* Cash in Hand Card */}
            <div className="bg-[#0d0d1a] border-2 border-amber-500/30 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-white">Physical Cash in Hand</span>
                </div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Shift Handover</span>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                <div className="text-xs text-amber-300 font-medium">Total COD Cash Collected Today</div>
                <div className="text-4xl font-black text-white mt-1.5">{fmt(shiftSummary?.cashInHandPaise ?? 0)}</div>
                <p className="text-[11px] text-white/40 mt-1">Hand over this cash amount to your store manager at the end of your shift.</p>
              </div>
            </div>

            {/* Recent Shift Completed Orders */}
            <div className="space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-white/40 px-1">
                Completed Shift History
              </div>
              {shiftSummary?.recentDeliveries?.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/30">No deliveries completed yet today.</div>
              ) : (
                shiftSummary?.recentDeliveries?.map((d: any) => (
                  <div key={d.id} className="bg-[#0d0d1a] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">Order #{d.display_id || d.id.slice(0, 8)}</div>
                      <div className="text-white/40 text-[10px]">{new Date(d.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{fmt(d.total_amount_paise)}</div>
                      <span className={`text-[9px] uppercase font-bold ${d.payment_method === 'cod' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {d.payment_method === 'cod' ? 'Cash Collected' : 'Prepaid'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: STORE MANAGER CONTACT ─────────────────────────────────── */}
        {activeTab === "store" && (
          <div className="bg-[#0d0d1a] border border-white/[0.06] rounded-3xl p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-400">
              <UserCheck className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">{shiftSummary?.restaurantName || "Store Management"}</h2>
              <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">
                Need help with an order, item delay, or cash handover? Contact your store manager directly.
              </p>
            </div>

            {shiftSummary?.storePhone ? (
              <a
                href={`tel:${shiftSummary.storePhone}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-black font-black text-sm uppercase tracking-wider transition-all shadow-lg"
              >
                <Phone className="w-4 h-4" /> Call Store Manager ({shiftSummary.storePhone})
              </a>
            ) : (
              <div className="text-xs text-white/30">Store contact number not configured. Contact your kitchen manager.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
