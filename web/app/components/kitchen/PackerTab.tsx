import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Package, Loader2, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

interface Order {
  id: string;
  display_id: string;
  status: string;
  created_at: string;
  items: any[];
}

export function PackerTab({
  orders,
  updateStatus,
  updatingId,
}: {
  orders: Order[];
  updateStatus: (id: string, status: string) => void;
  updatingId: string | null;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const preparingOrders = useMemo(() => orders.filter(o => o.status === "preparing"), [orders]);

  const toggleItem = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isOrderFullyPacked = (order: Order) => {
    return order.items.every((_, idx) => checkedItems[`${order.id}-${idx}`]);
  };

  if (preparingOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
        <Package className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-black">No Orders to Pack</h2>
        <p className="text-sm font-semibold mt-1">Waiting for chef to confirm new orders.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <AnimatePresence>
        {preparingOrders.map(order => {
          const displayId = order.display_id.replace("K-", "").replace("ORD-", "");
          const isPacked = isOrderFullyPacked(order);

          return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={order.id}
              className={`bg-[#111] rounded-[24px] border overflow-hidden flex flex-col transition-colors duration-300 ${isPacked ? "border-green-500/30" : "border-white/10"}`}
            >
              <div className={`p-4 sm:p-5 border-b border-white/5 flex justify-between items-center transition-colors duration-300 ${isPacked ? "bg-green-500/10" : ""}`}>
                <div>
                  <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Order</div>
                  <div className={`text-2xl font-black tracking-tight ${isPacked ? "text-green-400" : "text-white"}`}>
                    #{displayId}
                  </div>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-sm font-black text-white">{order.items.length} Items</span>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 space-y-3">
                {order.items.map((item, idx) => {
                  const key = `${order.id}-${idx}`;
                  const isChecked = checkedItems[key];

                  return (
                    <button
                      key={idx}
                      onClick={() => toggleItem(order.id, idx)}
                      className={`w-full flex items-start gap-4 p-3 rounded-xl border text-left transition-all ${isChecked ? "bg-green-500/10 border-green-500/30 opacity-70" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isChecked ? "bg-green-500 border-green-500" : "border-zinc-500"}`}>
                        {isChecked && <Check className="w-4 h-4 text-zinc-900 stroke-[3]" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-base font-bold leading-tight ${isChecked ? "text-green-400 line-through" : "text-white"}`}>
                            {item.quantity}x {item.name}
                          </span>
                        </div>
                        {item.customizations && item.customizations.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {item.customizations.map((cust: any, i: number) => (
                              <div key={i} className={`text-xs font-semibold flex items-start gap-1.5 ${isChecked ? "text-green-400/50" : "text-amber-400/90"}`}>
                                <span className="opacity-50">↳</span> {cust.group}: {cust.option}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.special_instructions && (
                          <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-2 text-amber-500 text-xs font-bold leading-snug">
                            {item.special_instructions}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 sm:p-5 pt-0">
                <button
                  onClick={() => updateStatus(order.id, "ready_for_pickup")}
                  disabled={!isPacked || updatingId === order.id}
                  className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center transition-all ${isPacked ? "bg-green-500 text-zinc-900 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}
                >
                  {updatingId === order.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "Mark Ready for Pickup"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
