import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, QrCode, Plus, Minus, Search, Receipt, CheckCircle, XCircle, Zap, UtensilsCrossed, X, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { socket } from "../../lib/socket";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-green-500",
  seated: "text-blue-500",
  completed: "text-zinc-500",
  cancelled: "text-red-500",
  no_show: "text-red-500",
};

const STATUS_BG: Record<string, string> = {
  confirmed: "bg-green-500/10 border-green-500/20",
  seated: "bg-blue-500/10 border-blue-500/20",
  completed: "bg-zinc-500/10 border-zinc-500/20",
  cancelled: "bg-red-500/10 border-red-500/20",
  no_show: "bg-red-500/10 border-red-500/20",
};

export function DineInTab({ restaurantId }: { restaurantId?: string }) {
  const [activeSub, setActiveSub] = useState<"Today" | "Bill">("Today");
  const [bookings, setBookings] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // POS Modal State
  const [staffOrderBooking, setStaffOrderBooking] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [skipKitchen, setSkipKitchen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState("");

  const fetchData = async () => {
    try {
      if (activeSub === "Today") {
        const data = await api.get("/kitchen/dine-in/today");
        setBookings(data || []);
      } else {
        const data = await api.get("/kitchen/dine-in/bill");
        setBills(data || []);
      }
    } catch (e: any) {
      toast.error("Failed to fetch dine-in data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [activeSub]);

  useEffect(() => {
    socket.on("table_order", fetchData);
    socket.on("table_checkin", fetchData);
    socket.on("table_booking_updated", fetchData);
    socket.on("table_checkout", fetchData);
    return () => {
      socket.off("table_order");
      socket.off("table_checkin");
      socket.off("table_booking_updated");
      socket.off("table_checkout");
    };
  }, [activeSub]);

  const handleCheckin = async (bookingId: string) => {
    try {
      await api.post(`/table-bookings/${bookingId}/checkin`, {});
      toast.success("Guest checked in");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Check-in failed");
    }
  };

  const handleNoShow = async (bookingId: string) => {
    if (!confirm("Mark this booking as no-show?")) return;
    try {
      await api.post(`/table-bookings/${bookingId}/no-show`, {});
      toast.success("Marked as no-show");
      fetchData();
    } catch (e: any) {
      toast.error("Failed to mark no-show");
    }
  };

  const handleMarkPaid = async (bookingId: string, method: string) => {
    if (!confirm(`Mark bill as paid via ${method}?`)) return;
    try {
      await api.post(`/table-bookings/${bookingId}/mark-paid`, { method });
      toast.success("Bill settled");
      fetchData();
    } catch (e: any) {
      toast.error("Failed to settle bill");
    }
  };

  // Open POS Modal
  const openPOS = async (booking: any) => {
    setStaffOrderBooking(booking);
    setOrderItems({});
    setSearch("");
    setSkipKitchen(false);
    if (!menuItems.length && booking.restaurant_id) {
      try {
        const res = await api.get(`/restaurants/${booking.restaurant_id}/menu`);
        setMenuItems(res.items || []);
      } catch (e) {
        toast.error("Failed to load menu");
      }
    }
  };

  const submitPOS = async () => {
    const items = Object.entries(orderItems)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      
    if (!items.length) return toast.error("Add at least one item");
    
    setProcessing(true);
    try {
      await api.post(`/table-bookings/${staffOrderBooking.id}/post-order`, { items, skipKitchen });
      toast.success("Order added to bill");
      setStaffOrderBooking(null);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to add order");
    } finally {
      setProcessing(false);
    }
  };

  // Scan simulation for Web
  const simulateScan = () => {
    if (!scanResult) return toast.error("Enter a booking ID");
    handleCheckin(scanResult);
    setScannerOpen(false);
  };

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const totalPosValue = menuItems.reduce((acc, item) => acc + (orderItems[item.id] || 0) * item.price_paise, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
          <button onClick={() => setActiveSub("Today")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSub === "Today" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"}`}>Today's Tables</button>
          <button onClick={() => setActiveSub("Bill")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSub === "Bill" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"}`}>Open Bills</button>
        </div>
        <button onClick={() => setScannerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 hover:bg-emerald-500/20 transition-all font-bold text-sm">
          <QrCode className="w-4 h-4" /> Scan QR
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
        </div>
      ) : activeSub === "Today" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map(b => (
            <div key={b.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="font-black text-lg text-white">{b.display_id}</span>
                <span className={`px-3 py-1 rounded-md text-xs font-black uppercase border ${STATUS_BG[b.status]} ${STATUS_COLORS[b.status]}`}>{b.status.replace('_', ' ')}</span>
              </div>
              <p className="text-zinc-400 text-sm font-medium mb-4">{b.customer_name || 'Guest'} {b.occasion && <span className="text-amber-500 ml-2 text-xs">({b.occasion})</span>}</p>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(b.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                  <Users className="w-3.5 h-3.5" />
                  {b.party_size}
                </div>
                {b.table_number && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    Table {b.table_number}
                  </div>
                )}
              </div>

              {b.pre_order_items?.length > 0 && (
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 mb-4 flex-1">
                  <p className="text-[10px] font-black uppercase text-emerald-500 mb-2 tracking-widest">Pre-Order</p>
                  {b.pre_order_items.map((i: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300"><span className="text-emerald-500 font-bold">{i.quantity}x</span> {i.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {b.status === "confirmed" && (
                <div className="flex gap-2 mt-auto pt-4 border-t border-white/5">
                  <button onClick={() => handleCheckin(b.id)} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-sm rounded-xl transition-all">Check In</button>
                  <button onClick={() => handleNoShow(b.id)} className="px-4 py-2.5 border border-red-500/30 hover:bg-red-500/10 text-red-500 font-bold text-sm rounded-xl transition-all">No Show</button>
                </div>
              )}
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center text-zinc-500">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">No bookings today</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bills.map(b => {
            const preAmt = b.pre_order_amount_paise || 0;
            const postAmt = b.post_order_amount_paise || 0;
            const gst = b.gst_amount_paise || 0;
            const paid = b.total_paid_paise || 0;
            const out = (preAmt + postAmt + gst) - paid;
            
            return (
              <div key={b.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-black text-lg text-white">{b.display_id}</span>
                  {b.table_number && <span className="font-black text-sm text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Table {b.table_number}</span>}
                </div>
                <p className="text-zinc-500 text-xs font-bold mb-4">{b.customer_name || 'Guest'} · {b.party_size} guests</p>
                
                <div className="space-y-2 mb-6 border border-white/5 rounded-xl p-4 bg-white/[0.02]">
                  <div className="flex justify-between text-xs font-semibold text-zinc-400"><span>Pre-Order</span><span>₹{(preAmt/100).toFixed(0)}</span></div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-400"><span>Post-Order</span><span>₹{(postAmt/100).toFixed(0)}</span></div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-400"><span>GST</span><span>₹{(gst/100).toFixed(0)}</span></div>
                  <div className="flex justify-between text-xs font-semibold text-emerald-500"><span>Paid</span><span>-₹{(paid/100).toFixed(0)}</span></div>
                  <div className="h-px w-full bg-white/10 my-2" />
                  <div className="flex justify-between text-sm font-black text-amber-500"><span>Outstanding</span><span>₹{(out/100).toFixed(0)}</span></div>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <button onClick={() => openPOS(b)} className="flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 font-bold text-sm rounded-xl transition-all">
                    <Plus className="w-4 h-4" /> Add Item (POS)
                  </button>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={() => handleMarkPaid(b.id, 'cash')} className="py-2.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl transition-all">Settle Cash</button>
                    <button onClick={() => handleMarkPaid(b.id, 'card_pos')} className="py-2.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl transition-all">Settle Card/UPI</button>
                  </div>
                </div>
              </div>
            );
          })}
          {bills.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center text-zinc-500">
              <Receipt className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">No open bills</p>
            </div>
          )}
        </div>
      )}

      {/* POS Modal */}
      <AnimatePresence>
        {staffOrderBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h2 className="text-xl font-black text-white">Add Items to Bill</h2>
                  <p className="text-zinc-500 text-xs font-semibold">{staffOrderBooking.display_id} · Table {staffOrderBooking.table_number}</p>
                </div>
                <button onClick={() => setStaffOrderBooking(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                  <button onClick={() => setSkipKitchen(false)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${!skipKitchen ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}><UtensilsCrossed className="w-4 h-4" /> Via Kitchen Ticket</button>
                  <button onClick={() => setSkipKitchen(true)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${skipKitchen ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white"}`}><Zap className="w-4 h-4" /> Direct to Bill</button>
                </div>

                <div className="relative mb-6">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-all font-semibold" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredMenu.map(item => {
                    const qty = orderItems[item.id] || 0;
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-zinc-900 border border-white/5 rounded-xl">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-lg">🍽️</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                          <p className="text-emerald-400 text-xs font-black">₹{(item.price_paise/100).toFixed(0)}</p>
                        </div>
                        {qty > 0 ? (
                          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-1">
                            <button onClick={() => setOrderItems(p => ({ ...p, [item.id]: Math.max(0, qty - 1) }))} className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30"><Minus className="w-3 h-3" /></button>
                            <span className="text-sm font-black w-4 text-center text-emerald-400">{qty}</span>
                            <button onClick={() => setOrderItems(p => ({ ...p, [item.id]: qty + 1 }))} className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30"><Plus className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setOrderItems(p => ({ ...p, [item.id]: 1 }))} className="px-4 py-2 border-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 rounded-lg font-black text-xs transition-all">ADD</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalPosValue > 0 && (
                <div className="p-6 border-t border-white/10 bg-[#0a0a0a]">
                  <button onClick={submitPOS} disabled={processing} className="w-full py-4 rounded-xl bg-emerald-500 text-black font-black text-sm uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : skipKitchen ? "⚡ Add Directly to Bill" : "🍳 Send Ticket to Kitchen"}
                    · ₹{(totalPosValue/100).toFixed(0)}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Scanner Mock */}
      <AnimatePresence>
        {scannerOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#111] border border-white/10 rounded-[32px] p-6 flex flex-col items-center text-center">
                <QrCode className="w-16 h-16 text-emerald-500 mb-4" />
                <h2 className="text-xl font-black text-white mb-2">Scan Guest QR</h2>
                <p className="text-zinc-500 text-sm mb-6">In the web portal, enter the Booking ID manually to simulate a camera scan.</p>
                <input type="text" value={scanResult} onChange={e => setScanResult(e.target.value)} placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white mb-4 text-center font-mono" />
                <div className="flex gap-2 w-full">
                  <button onClick={() => setScannerOpen(false)} className="flex-1 py-3 border border-white/10 text-zinc-400 hover:text-white rounded-xl font-bold">Cancel</button>
                  <button onClick={simulateScan} className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-black">Simulate Scan</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
