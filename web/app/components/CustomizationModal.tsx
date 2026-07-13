"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import Image from "next/image";
import { useHaptics } from "../../hooks/useHaptics";

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onAddToCart: (customizations: any[], instructions: string) => void;
}

export function CustomizationModal({ isOpen, onClose, item, onAddToCart }: CustomizationModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const haptics = useHaptics();

  // Reset state when a new item is opened
  useEffect(() => {
    if (isOpen && item) {
      setSelectedOptions({});
      setInstructions("");
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const groups = item.customization_groups || [];
  const basePrice = (item.price_paise || 0) / 100;

  let extraCost = 0;
  Object.keys(selectedOptions).forEach(groupName => {
    const optName = selectedOptions[groupName];
    const group = groups.find((g: any) => g.name === groupName);
    const option = group?.options.find((o: any) => o.name === optName);
    if (option?.price_paise) extraCost += option.price_paise / 100;
  });

  const totalPrice = basePrice + extraCost;

  const handleSelect = (groupName: string, optionName: string) => {
    haptics.tap();
    setSelectedOptions(prev => ({
      ...prev,
      [groupName]: optionName
    }));
  };

  const isAddEnabled = groups.filter((g: any) => g.required).every((g: any) => selectedOptions[g.name]);

  const handleAdd = () => {
    if (!isAddEnabled) return;
    haptics.tap();
    
    const customArray = Object.keys(selectedOptions).map(g => {
      const group = groups.find((gr: any) => gr.name === g);
      const option = group?.options.find((o: any) => o.name === selectedOptions[g]);
      return {
        group: g,
        option: selectedOptions[g],
        photo_url: option?.photo_url || undefined,
        price_paise: option?.price_paise || 0
      };
    });
    
    onAddToCart(customArray, instructions);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-h-[85vh] md:max-w-md md:mx-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-2xl z-[210] bg-white shadow-2xl flex flex-col rounded-t-[24px] overflow-hidden"
            style={typeof window !== 'undefined' && window.innerWidth >= 768 ? { y: "-50%", transform: "translateY(-50%)" } : {}}
          >
            {/* Header */}
            <div className="p-5 border-b border-black/5 flex items-center justify-between bg-white shrink-0">
               <div>
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight">Customise {item.name}</h2>
                  <p className="text-sm font-bold text-zinc-500 mt-0.5">₹{basePrice}</p>
               </div>
               <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                  <X className="w-5 h-5 text-zinc-600" />
               </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-zinc-50/50 pb-32">
              
              {groups.map((group: any, idx: number) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-black/[0.04] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[17px] font-bold text-zinc-900">{group.name}</h3>
                    {group.required && (
                      <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded tracking-wider">REQUIRED</span>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {group.options.map((opt: any, optIdx: number) => {
                      const isSelected = selectedOptions[group.name] === opt.name;
                      return (
                        <div 
                          key={optIdx}
                          onClick={() => handleSelect(group.name, opt.name)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-colors cursor-pointer select-none ${
                            isSelected ? 'border-brand-primary bg-brand-primary/5' : 'border-zinc-100 hover:border-zinc-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-brand-primary' : 'border-zinc-300'}`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary" />}
                            </div>
                            {opt.photo_url && (
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-100">
                                <Image src={opt.photo_url} alt={opt.name} width={40} height={40} className="object-cover w-full h-full" />
                              </div>
                            )}
                            <span className={`text-[15px] font-medium ${isSelected ? 'text-brand-dark font-bold' : 'text-zinc-700'}`}>
                              {opt.name}
                            </span>
                          </div>
                          {opt.price_paise > 0 && (
                            <span className="text-sm font-bold text-zinc-500">+₹{opt.price_paise / 100}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Special Instructions */}
              <div className="bg-white p-5 rounded-2xl border border-black/[0.04] shadow-sm">
                <h3 className="text-[17px] font-bold text-zinc-900 mb-3">Special Instructions</h3>
                <textarea
                  placeholder="e.g. Make it less spicy, no onions..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all resize-none h-24"
                  maxLength={100}
                />
              </div>

            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-black/5 shrink-0">
              <button 
                onClick={handleAdd}
                disabled={!isAddEnabled}
                className={`w-full h-14 rounded-2xl flex items-center justify-center text-lg font-black tracking-wide shadow-lg transition-all ${
                  isAddEnabled 
                    ? 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/30 active:scale-[0.98]' 
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
                }`}
              >
                Add Item  ·  ₹{totalPrice}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
