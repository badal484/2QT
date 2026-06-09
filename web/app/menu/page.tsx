"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Minus, ShoppingBag, X, ChevronRight, 
  Star, Clock, Zap, CheckCircle2, Search, 
  ArrowLeft, Filter, Heart, Info, Loader2, MapPin
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCart, useAuth } from "../layout";
import { api } from "../lib/api";
import { Toaster, toast } from "sonner";

const MapPicker = dynamic(() => import('../../components/MapPicker'), { 
  ssr: false, 
  loading: () => (
    <div className="h-full flex items-center justify-center bg-zinc-100 rounded-2xl border border-zinc-200">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary/50" />
    </div>
  )
});

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price_paise: number;
  category: string;
  available: boolean;
  photo_url?: string;
  is_veg?: boolean;
}

function getDishImage(name: string, category: string, photo_url?: string) {
  if (photo_url) return photo_url;
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes("naan") || c.includes("bread") || n.includes("roti")) return "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop";
  if (n.includes("biryani") || c.includes("rice")) return "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?q=80&w=800&auto=format&fit=crop";
  if (n.includes("mutton") || n.includes("rogan") || n.includes("lamb")) return "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop";
  if (n.includes("paneer") || n.includes("tikka") || c.includes("appetizer") || c.includes("curry") || c.includes("main")) return "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop";
  if (c.includes("healthy") || n.includes("salad") || n.includes("bowl")) return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop";
  if (c.includes("dessert") || n.includes("cake") || n.includes("sweet")) return "https://images.unsplash.com/photo-1563805042-7684c8e9e533?q=80&w=800&auto=format&fit=crop";
  if (c.includes("pasta") || n.includes("alfredo") || n.includes("risotto")) return "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=800&auto=format&fit=crop";
  if (c.includes("burger") || n.includes("sandwich")) return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop";
  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop";
}

function OrderSuccess({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center text-center p-8"
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-32 h-32 rounded-[40px] bg-brand-primary flex items-center justify-center mb-10 shadow-[0_20px_50px_rgba(255,107,53,0.3)]"
      >
        <CheckCircle2 className="w-16 h-16 text-white" />
      </motion.div>
      <h2 className="text-4xl font-bold tracking-tight mb-4 text-brand-dark">Order Confirmed</h2>
      <p className="text-black/60 text-lg font-medium mb-12 max-w-sm">Our master chefs are now preparing your gourmet meal with care.</p>
      <button
        onClick={onDone}
        className="group bg-brand-dark text-white px-10 py-4 rounded-2xl text-sm font-semibold hover:bg-black transition-all shadow-xl"
      >
        Track Order <ChevronRight className="inline-block w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [allAddresses, setAllAddresses] = useState<any[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [newAddressDetails, setNewAddressDetails] = useState({ label: "Home", flat: "", area: "", landmark: "" });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccessId, setOrderSuccessId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [serviceable, setServiceable] = useState<boolean | null>(null);
  const [payMethod, setPayMethod] = useState<"online" | "cod">("online");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const { user } = useAuth()!;
  const { items: cartItems, addItem, removeItem, total, clearCart } = useCart()!;
  const router = useRouter();

  useEffect(() => {
    const loadMenu = async (lat: number, lng: number) => {
      try {
        const check = await api.get(`/menu/zones/check?lat=${lat}&lng=${lng}`);
        if (check.serviceable && check.zone) {
          setServiceable(true);
          setZoneId(check.zone.id);
          const [menuRes, bannerRes] = await Promise.all([
            api.get(`/menu?zoneId=${check.zone.id}`),
            api.get(`/banners`)
          ]);
          setItems(menuRes.items ?? []);
          setCategories(["All", ...Array.from(new Set((menuRes.items ?? []).map((i: MenuItem) => i.category))) as string[]]);
          setBanners(bannerRes.banners ?? []);
        } else {
          setServiceable(false);
        }
      } catch {
        // Backend offline — load demo menu so UI is always functional
        setServiceable(true);
        setItems([
          { id: "1", name: "Premium Butter Naan", description: "Soft, buttery, baked in a traditional tandoor.", price_paise: 9000, category: "Breads", available: true },
          { id: "2", name: "Classic Chicken Biryani", description: "Aromatic basmati rice with tender chicken.", price_paise: 35000, category: "Main Course", available: true },
          { id: "3", name: "Paneer Butter Masala", description: "Rich creamy tomato gravy with soft cottage cheese.", price_paise: 28000, category: "Main Course", available: true },
          { id: "4", name: "Chocolate Lava Cake", description: "Warm chocolate cake with a molten center.", price_paise: 18000, category: "Dessert", available: true },
        ]);
        setCategories(["All", "Breads", "Main Course", "Dessert"]);
        setBanners([{ id: '1', title: 'Gourmet Meals Crafted for you', subtitle: 'Lightning fast 15-minute delivery.', tag_text: '15 MIN', image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2000&auto=format&fit=crop', action_type: 'NONE' }]);
      } finally {
        setLoading(false);
      }
    };

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadMenu(pos.coords.latitude, pos.coords.longitude),
        () => loadMenu(12.9716, 77.5946), // Bangalore center fallback if denied
        { timeout: 5000 }
      );
    } else {
      loadMenu(12.9716, 77.5946);
    }
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    if (!isCartOpen || !user) return;
    Promise.all([
      api.get("/customers/wallet").catch(() => ({ balance_paise: 0 })),
      api.get("/customers/loyalty").catch(() => ({ points: 0 })),
    ]).then(([w, l]) => {
      setWalletBalance(w.balancePaise ?? 0);
      setLoyaltyPoints(l.points ?? 0);
    });
  }, [isCartOpen, user]);

  useEffect(() => {
    if (!isCartOpen || cartItems.length === 0 || !deliveryAddress) {
      setPricing(null);
      return;
    }
    setPricingLoading(true);
    api.post("/payments/create-order", {
      addressId: deliveryAddress.id,
      items: cartItems.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
      promoCode: promoApplied || undefined,
      useWallet,
      useLoyalty,
      dryRun: true,
    }).then(d => setPricing(d.pricing ?? null)).catch(() => setPricing(null)).finally(() => setPricingLoading(false));
  }, [isCartOpen, cartItems, deliveryAddress, promoApplied, useWallet, useLoyalty]);

  const filtered = items.filter(item =>
    item.available &&
    (activeCategory === "All" || item.category === activeCategory) &&
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const qty = (id: string) => cartItems.find(i => i.id === id)?.quantity ?? 0;

  const fetchAddress = async () => {
    if (!user) return;
    try {
      const res = await api.get("/customers/addresses");
      if (res.addresses) {
        setAllAddresses(res.addresses);
        if (res.addresses.length > 0 && !deliveryAddress) {
          setDeliveryAddress(res.addresses[res.addresses.length - 1]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAddress();
  }, [user]);

  const handleOpenAddressModal = () => {
    setIsAddingNewAddress(false);
    setNewAddressDetails({ label: "Home", flat: "", area: "", landmark: "" });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    const fullText = `${newAddressDetails.flat.trim()}, ${newAddressDetails.area.trim()}${newAddressDetails.landmark.trim() ? `, Near ${newAddressDetails.landmark.trim()}` : ""}`;
    
    if (fullText.length < 5 || !newAddressDetails.flat || !newAddressDetails.area) {
      toast.error("Please enter complete address details");
      return;
    }
    setIsSavingAddress(true);
    try {
      const res = await api.post("/customers/addresses", {
        label: newAddressDetails.label,
        addressText: fullText,
        lat: 12.9716, lng: 77.5946, // fallback coordinates
        zoneId,
      });
      if (res.address) {
        setDeliveryAddress(res.address);
        setAllAddresses(prev => [...prev, res.address]);
        setIsAddressModalOpen(false);
        setIsAddingNewAddress(false);
        toast.success("Delivery address updated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  // ensureAddress removed because we now enforce explicit selection

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const placeOrder = async (method: "online" | "cod" = "online") => {
    if (!user) { router.push("/login"); return; }
    if (!deliveryAddress) {
      toast.error("Please select a delivery address first!");
      setIsAddressModalOpen(true);
      return;
    }
    setIsPlacingOrder(true);
    try {
      const res = await api.post("/payments/create-order", {
          addressId: deliveryAddress.id,
          paymentMethod: method,
          items: cartItems.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
          promoCode: promoApplied || undefined,
          useWallet,
          useLoyalty,
      });

      if (res.status === "confirmed") {
        setOrderSuccessId(res.orderId);
        clearCart();
        toast.success("Order Confirmed!");
        return;
      }

      if (res.razorpayOrderId) {
        const options = {
          key: res.keyId,
          amount: res.amount,
          currency: "INR",
          name: "2QT",
          description: "Gourmet Order",
          order_id: res.razorpayOrderId,
          handler: async function (response: any) {
            try {
              await api.post("/payments/verify-payment", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });
              setOrderSuccessId(res.orderId);
              clearCart();
              toast.success("Payment Successful!");
            } catch (err: any) {
              toast.error("Payment verification failed: " + err.message);
            }
          },
          prefill: {
            name: user.name,
            email: user.email,
          },
          theme: {
            color: "#FF6B35",
          },
        };

        if (typeof (window as any).Razorpay === 'undefined') {
          toast.error("Payment gateway failed to load. Please check your connection or disable adblockers.");
          return;
        }

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any){
          toast.error(response.error.description || "Payment failed");
        });
        rzp.open();
      }
    } catch (err: any) {
      toast.error(err.message || "System error");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-brand-light flex flex-col items-center justify-center gap-6">
      <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
      <div className="text-sm font-medium text-black/40">Finding your location…</div>
    </div>
  );

  if (serviceable === false) return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-24 h-24 rounded-3xl bg-brand-primary/10 flex items-center justify-center mb-8 shadow-lg"
      >
        <MapPin className="w-12 h-12 text-brand-primary" />
      </motion.div>
      <h1 className="text-3xl font-bold text-zinc-900 mb-3">Not in our zone yet</h1>
      <p className="text-zinc-500 font-medium max-w-sm mb-2">
        We're currently delivering only within select areas of Bengaluru.
      </p>
      <p className="text-zinc-400 text-sm max-w-xs mb-10">
        We're expanding fast — leave your number and we'll notify you the day we reach your area.
      </p>
      <a
        href="https://wa.me/918867000000?text=Hi%2C%20I%20want%20Velto%20to%20deliver%20in%20my%20area%21"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-semibold text-sm shadow-lg shadow-brand-primary/25 hover:bg-brand-dark transition-colors"
      >
        Notify Me When You're Here
      </a>
      <p className="text-xs text-zinc-400 mt-6">Currently serving: Kundanahalli, Whitefield area</p>
    </div>
  );

  if (orderSuccessId) return <OrderSuccess onDone={() => router.push(`/orders/${orderSuccessId}`)} />;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-brand-dark selection:bg-brand-primary selection:text-white font-sans antialiased pb-24">
      {/* ── Floating Cart Bottom Bar (World Class UX) ── */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg z-[90]"
          >
            <button 
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-brand-primary text-white p-4 rounded-2xl shadow-[0_15px_40px_-10px_rgba(255,107,53,0.5)] flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <div className="flex flex-col items-start">
                <span className="text-[11px] font-black uppercase tracking-widest text-white/80">{cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'}</span>
                <span className="text-lg font-bold">₹{total / 100}</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-sm">
                View Cart <ShoppingBag className="w-4 h-4" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation & Sticky Search ── */}
      <div className="fixed top-0 w-full z-[80] bg-white/90 backdrop-blur-xl border-b border-black/[0.03] shadow-sm pb-3">
        <nav className="px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-black tracking-tighter shrink-0 font-outfit flex flex-col items-start leading-none">
               <span>2QT<span className="text-brand-primary">.</span></span>
               <span className="text-[9px] uppercase tracking-widest text-brand-primary mt-1 font-bold flex items-center gap-1"><Zap className="w-3 h-3 fill-brand-primary"/> 15-MIN DELIVERY</span>
            </Link>

            <div className="flex items-center gap-3">
              <Link href="/subscription" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary/20 transition-colors">
                <Zap className="w-3 h-3" /> Meal Plans
              </Link>
              <Link href="/profile" className="w-10 h-10 rounded-full bg-[#111] text-white flex items-center justify-center font-bold text-sm hover:scale-105 transition-transform shadow-md">
                 {user ? user.name?.[0]?.toUpperCase() : "V"}
              </Link>
            </div>
          </div>
        </nav>
        
        {/* Global Search Bar (Mobile & Desktop) */}
        <div className="max-w-5xl mx-auto px-4 mt-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text"
              placeholder="Search for delicious meals..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-100/80 border border-transparent rounded-[16px] py-3 pl-11 pr-4 text-[15px] font-semibold focus:bg-white focus:shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:border-brand-primary/30 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <main className="pt-36 max-w-5xl mx-auto px-4 md:px-0">
        
        {/* ── Dynamic Promo Banner Carousel ── */}
        {banners.length > 0 && (
          <div className="relative w-full h-[140px] md:h-[160px] rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-black mb-6">
             <AnimatePresence initial={false}>
               <motion.div
                 key={currentBannerIndex}
                 initial={{ opacity: 0, x: 50 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -50 }}
                 transition={{ duration: 0.5, ease: "easeInOut" }}
                 className="absolute inset-0 cursor-pointer"
                 onClick={() => {
                    const banner = banners[currentBannerIndex];
                    if (banner.action_type === "FILTER_CATEGORY") setActiveCategory(banner.action_payload);
                    // Add APPLY_COUPON logic here if needed
                 }}
               >
                 <Image 
                   src={banners[currentBannerIndex].image_url}
                   alt={banners[currentBannerIndex].title}
                   fill
                   priority
                   className="object-cover opacity-60"
                 />
                 <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                 <div className="absolute inset-0 p-5 md:p-6 z-10 flex flex-col justify-center max-w-[70%]">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-primary text-[9px] font-black uppercase tracking-widest text-white mb-2 w-fit shadow-md">
                       <Zap className="w-3 h-3" /> {banners[currentBannerIndex].tag_text}
                    </div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight text-white font-outfit leading-tight mb-1">
                      {banners[currentBannerIndex].title}
                    </h2>
                    <p className="text-white/70 text-xs md:text-sm font-medium line-clamp-1">{banners[currentBannerIndex].subtitle}</p>
                 </div>
               </motion.div>
             </AnimatePresence>
             
             {/* Carousel Dots */}
             {banners.length > 1 && (
               <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
                 {banners.map((_, idx) => (
                   <div 
                     key={idx} 
                     className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentBannerIndex ? 'w-4 bg-brand-primary' : 'w-1.5 bg-white/40'}`} 
                   />
                 ))}
               </div>
             )}
          </div>
        )}

        {/* ── Categories Scroll ── */}
        <div className="sticky top-[110px] z-[70] bg-[#F9FAFB]/95 backdrop-blur-md -mx-4 px-4 md:mx-0 md:px-0 py-2 mb-2 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shrink-0 ${
                  activeCategory === cat 
                  ? "bg-[#111] text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)]" 
                  : "bg-white text-zinc-500 border border-black/[0.04] hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

          {/* ── Horizontal List Menu Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <AnimatePresence mode="popLayout">
              {filtered.map(item => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => setSelectedItem(item)}
                  className="bg-white rounded-[24px] p-5 flex gap-5 border border-transparent shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                >
                  {/* Left: Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      {item.is_veg !== undefined && (
                        <div className="mb-2">
                           <span className={`inline-flex items-center justify-center w-4 h-4 border ${item.is_veg ? 'border-green-600' : 'border-red-600'} rounded-[4px] p-[2px]`}>
                             <span className={`w-full h-full rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`}></span>
                           </span>
                        </div>
                      )}
                      <h3 className="text-[17px] font-bold text-zinc-900 leading-snug truncate mb-1.5">{item.name}</h3>
                      <div className="text-sm font-bold text-zinc-900 mb-2.5">₹{item.price_paise / 100}</div>
                      <p className="text-zinc-500 text-[13px] font-medium line-clamp-2 leading-relaxed pr-2">
                        {item.description || "A masterfully crafted gourmet experience delivered with exceptional care."}
                      </p>
                    </div>
                  </div>

                  {/* Right: Image & Add Button */}
                  <div className="relative w-[130px] h-[130px] shrink-0">
                    <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-zinc-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                      <Image
                        src={getDishImage(item.name, item.category, item.photo_url)}
                        alt={item.name}
                        fill
                        sizes="130px"
                        className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      />
                    </div>

                    {/* Elevated Add Button overlapping the image */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[90%] z-10" onClick={e => e.stopPropagation()}>
                      {qty(item.id) === 0 ? (
                        <button
                          onClick={() => addItem(item)}
                          className="w-full bg-white text-brand-primary border border-brand-primary/20 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_8px_20px_-6px_rgba(255,107,53,0.3)] hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-95"
                        >
                          ADD
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-brand-primary text-white p-1.5 rounded-xl shadow-[0_8px_20px_-6px_rgba(255,107,53,0.5)] border border-brand-primary-dark">
                          <button onClick={() => removeItem(item.id)} className="w-8 h-8 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-black">{qty(item.id)}</span>
                          <button onClick={() => addItem(item)} className="w-8 h-8 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {filtered.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center">
              <Search className="w-10 h-10 text-zinc-300 mb-4" />
              <p className="text-zinc-500 font-semibold">No dishes found matching your criteria.</p>
            </div>
          )}
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: "100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-[160] bg-white shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between bg-white">
                 <div>
                    <h2 className="text-2xl font-bold text-brand-dark">Your Order</h2>
                    <p className="text-sm font-medium text-black/50 mt-1">{cartItems.length} items</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                    <X className="w-5 h-5 text-brand-dark" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-brand-light/50">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black/5 shrink-0">
                      <Image 
                        src={getDishImage(item.name, item.category, (item as any).photo_url)} 
                        alt={item.name} 
                        fill 
                        sizes="80px"
                        className="object-cover" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-base font-bold text-brand-dark truncate mb-1">{item.name}</p>
                       <p className="text-sm font-bold text-brand-primary mb-3">₹{item.price_paise / 100}</p>
                       <div className="flex items-center gap-3">
                          <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center hover:text-red-500 transition-colors">
                             <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => addItem(item)} className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center hover:bg-brand-primary hover:text-white transition-colors">
                             <Plus className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                  </div>
                ))}
                
                {cartItems.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-black/40">
                    <ShoppingBag className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Your cart is empty</p>
                    <p className="text-sm mt-2">Add some delicious meals to get started!</p>
                  </div>
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="p-6 bg-white border-t border-black/5 shrink-0">
                    {deliveryAddress ? (
                      <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                         <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-brand-primary" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Delivering To</p>
                              <button onClick={handleOpenAddressModal} className="text-xs font-bold text-brand-primary hover:text-brand-primary-dark uppercase tracking-wider transition-colors">Change</button>
                            </div>
                            <p className="text-sm font-semibold text-zinc-900 truncate">
                              {deliveryAddress.address_text}
                            </p>
                         </div>
                      </div>
                    ) : (
                      <button 
                        onClick={handleOpenAddressModal}
                        className="w-full flex items-center gap-3 mb-6 p-4 rounded-xl border border-dashed border-brand-primary/40 bg-brand-primary/5 hover:bg-brand-primary/10 hover:border-brand-primary/60 transition-colors group text-left"
                      >
                         <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 group-hover:bg-brand-primary group-hover:text-white transition-colors text-brand-primary">
                            <Plus className="w-4 h-4" />
                         </div>
                         <div className="flex-1">
                            <p className="text-sm font-bold text-brand-dark group-hover:text-brand-primary transition-colors">Add Delivery Address</p>
                            <p className="text-xs font-semibold text-brand-primary/70">Required to place your order</p>
                         </div>
                         <ChevronRight className="w-4 h-4 text-brand-primary/50 group-hover:text-brand-primary transition-colors" />
                      </button>
                    )}
                    {/* Promo Code */}
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Promo code"
                          value={promoCode}
                          onChange={e => setPromoCode(e.target.value.toUpperCase())}
                          className="flex-1 border border-black/10 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-brand-primary"
                        />
                        {promoApplied ? (
                          <button
                            onClick={() => { setPromoApplied(""); setPromoCode(""); }}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 border border-red-100"
                          >Remove</button>
                        ) : (
                          <button
                            onClick={() => { if (promoCode.trim()) setPromoApplied(promoCode.trim()); }}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                          >Apply</button>
                        )}
                      </div>
                      {promoApplied && pricing?.discountPaise > 0 && (
                        <p className="text-xs text-green-600 font-semibold mt-1.5 ml-1">Promo applied! -₹{pricing.discountPaise / 100}</p>
                      )}
                      {promoApplied && pricing && !pricing.discountPaise && (
                        <p className="text-xs text-red-500 font-semibold mt-1.5 ml-1">Invalid or expired promo code</p>
                      )}
                    </div>

                    {/* Wallet & Loyalty */}
                    {user && (walletBalance > 0 || loyaltyPoints > 0) && (
                      <div className="mb-4 space-y-2">
                        {walletBalance > 0 && (
                          <button
                            onClick={() => setUseWallet(v => !v)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${useWallet ? "bg-green-50 border-green-300 text-green-700" : "bg-zinc-50 border-black/10 text-black/60"}`}
                          >
                            <span>Use Wallet (₹{(walletBalance / 100).toFixed(2)} available)</span>
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${useWallet ? "bg-green-500 border-green-500" : "border-black/20"}`}>
                              {useWallet && <span className="text-white text-[10px]">✓</span>}
                            </span>
                          </button>
                        )}
                        {loyaltyPoints > 0 && (
                          <button
                            onClick={() => setUseLoyalty(v => !v)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${useLoyalty ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-zinc-50 border-black/10 text-black/60"}`}
                          >
                            <span>Use {loyaltyPoints} Loyalty Points</span>
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${useLoyalty ? "bg-amber-500 border-amber-500" : "border-black/20"}`}>
                              {useLoyalty && <span className="text-white text-[10px]">✓</span>}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-4 mb-6">
                      <div className="flex flex-col gap-3">
                          <p className="text-sm font-bold text-brand-dark">Payment Method</p>
                          <div className="flex gap-3">
                              {["online", "cod"].map((m) => (
                                  <button
                                      key={m}
                                      onClick={() => setPayMethod(m as any)}
                                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                                          payMethod === m
                                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                                          : "bg-white border-black/10 text-black/60 hover:border-black/20"
                                      }`}
                                  >
                                      {m === "online" ? "Pay Online" : "Cash on Delivery"}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="pt-4 space-y-3">
                        {pricing ? (
                          <>
                            <div className="flex justify-between text-sm font-medium text-black/60">
                               <span>Subtotal</span>
                               <span>₹{pricing.subtotalPaise / 100}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-black/60">
                               <span>Delivery Fee</span>
                               <span>₹{pricing.deliveryFeePaise / 100}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-black/60">
                               <span>Taxes (GST)</span>
                               <span>₹{((pricing.cgstPaise ?? 0) + (pricing.sgstPaise ?? 0)) / 100}</span>
                            </div>
                            {pricing.discountPaise > 0 && (
                              <div className="flex justify-between text-sm font-medium text-green-600">
                                 <span>Promo Discount</span>
                                 <span>-₹{pricing.discountPaise / 100}</span>
                              </div>
                            )}
                            {pricing.walletDeductionPaise > 0 && (
                              <div className="flex justify-between text-sm font-medium text-green-600">
                                 <span>Wallet Applied</span>
                                 <span>-₹{pricing.walletDeductionPaise / 100}</span>
                              </div>
                            )}
                            {pricing.loyaltyDiscountPaise > 0 && (
                              <div className="flex justify-between text-sm font-medium text-amber-600">
                                 <span>Loyalty Points</span>
                                 <span>-₹{pricing.loyaltyDiscountPaise / 100}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm font-medium text-black/60">
                               <span>Subtotal</span>
                               <span>₹{total / 100}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-black/60">
                               <span>Delivery Fee</span>
                               <span>₹25</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-black/60">
                               <span>Taxes (5% GST)</span>
                               <span>₹{Math.round(total * 0.05) / 100}</span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex justify-between items-end pt-4 border-t border-black/5">
                         <span className="text-base font-bold text-brand-dark">Total Amount</span>
                         <span className="text-3xl font-bold text-brand-dark">
                           {pricing ? `₹${pricing.totalAmountPaise / 100}` : `₹${Math.round(total + 2500 + (total * 0.05)) / 100}`}
                         </span>
                      </div>
                   </div>
                   
                   <button
                      onClick={() => placeOrder(payMethod)}
                      disabled={isPlacingOrder || cartItems.length === 0}
                      className="w-full bg-brand-primary text-white py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-3 hover:bg-brand-primary-dark transition-all shadow-lg shadow-brand-primary/30 disabled:opacity-50 disabled:shadow-none"
                   >
                      {isPlacingOrder ? (
                         <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                         <>Place Order <ChevronRight className="w-5 h-5" /></>
                      )}
                   </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: "100%", opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: "100%", opacity: 0 }} 
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 md:bottom-auto md:top-1/2 left-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:max-w-2xl z-[210] bg-white md:rounded-[32px] rounded-t-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="relative w-full aspect-video bg-black/5">
                <Image
                  src={getDishImage(selectedItem.name, selectedItem.category, selectedItem.photo_url)}
                  alt={selectedItem.name}
                  fill
                  className="object-cover"
                />
                <button 
                  onClick={() => setSelectedItem(null)} 
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                >
                  <X className="w-5 h-5 text-brand-dark" />
                </button>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <span className="inline-block bg-black/5 text-brand-dark text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                      {selectedItem.category}
                    </span>
                    <h2 className="text-3xl font-bold text-brand-dark leading-tight">{selectedItem.name}</h2>
                  </div>
                  <div className="text-2xl font-bold text-brand-primary shrink-0">₹{selectedItem.price_paise / 100}</div>
                </div>
                
                <p className="text-black/60 text-base font-medium leading-relaxed mb-8">
                  {selectedItem.description || "A masterfully crafted gourmet experience delivered with exceptional care."}
                </p>

                <div className="pt-6 border-t border-black/5">
                  {qty(selectedItem.id) === 0 ? (
                    <button
                      onClick={() => { addItem(selectedItem); setSelectedItem(null); setIsCartOpen(true); }}
                      className="w-full bg-brand-primary text-white py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-2 hover:bg-brand-primary-dark transition-all shadow-lg shadow-brand-primary/30"
                    >
                      <Plus className="w-5 h-5" /> Add to Order
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex-1 flex items-center justify-between bg-brand-light rounded-2xl p-2 border border-black/5">
                        <button onClick={() => removeItem(selectedItem.id)} className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-brand-dark hover:text-red-500 transition-colors">
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-center font-bold text-xl">{qty(selectedItem.id)}</span>
                        <button onClick={() => addItem(selectedItem)} className="w-12 h-12 rounded-xl bg-brand-primary shadow-sm flex items-center justify-center text-white hover:bg-brand-primary-dark transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <button 
                        onClick={() => { setSelectedItem(null); setIsCartOpen(true); }}
                        className="bg-brand-dark text-white px-8 py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
                      >
                        View Cart
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Premium Address Edit Modal */}
      <AnimatePresence>
        {isAddressModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setIsAddressModalOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-black/5 shrink-0 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  {isAddingNewAddress && (
                    <button onClick={() => setIsAddingNewAddress(false)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h3 className="text-xl font-bold font-outfit text-zinc-900">
                    {isAddingNewAddress ? "Add New Address" : "Select Address"}
                  </h3>
                </div>
                <button onClick={() => setIsAddressModalOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Body */}
              <div className="p-6 overflow-y-auto">
                {!isAddingNewAddress ? (
                  <div className="space-y-4">
                    {allAddresses.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Saved Addresses</p>
                        {allAddresses.map(addr => (
                          <div 
                            key={addr.id}
                            onClick={() => {
                              setDeliveryAddress(addr);
                              setIsAddressModalOpen(false);
                            }}
                            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${deliveryAddress?.id === addr.id ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20' : 'border-zinc-200 hover:border-brand-primary/50 hover:bg-zinc-50'}`}
                          >
                            <div className={`mt-0.5 shrink-0 ${deliveryAddress?.id === addr.id ? 'text-brand-primary' : 'text-zinc-400'}`}>
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className={`text-sm font-bold mb-1 ${deliveryAddress?.id === addr.id ? 'text-brand-primary' : 'text-zinc-900'}`}>{addr.label || "Address"}</h4>
                              <p className="text-sm text-zinc-500 leading-relaxed">{addr.address_text}</p>
                            </div>
                            {deliveryAddress?.id === addr.id && (
                              <CheckCircle2 className="w-5 h-5 text-brand-primary shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                          <MapPin className="w-8 h-8" />
                        </div>
                        <p className="text-zinc-500 font-medium">No saved addresses found.</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-black/5 mt-4">
                      <button 
                        onClick={() => setIsAddingNewAddress(true)}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        Add New Address
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Interactive Map Picker */}
                    <div className="h-48 rounded-2xl relative overflow-hidden">
                       <MapPicker 
                         onLocationSelect={({ area, landmark, lat, lng }) => {
                           setNewAddressDetails(prev => ({
                             ...prev,
                             area: area || prev.area,
                             landmark: landmark || prev.landmark
                           }));
                           // In a real app we'd also store lat/lng to send to the backend
                         }} 
                       />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Flat / House No / Floor / Building *</label>
                        <input 
                          type="text"
                          value={newAddressDetails.flat}
                          onChange={(e) => setNewAddressDetails(prev => ({ ...prev, flat: e.target.value }))}
                          placeholder="e.g. Flat 402, Block B"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3.5 px-4 text-sm font-medium focus:bg-white focus:border-brand-primary focus:ring-4 ring-brand-primary/10 transition-all outline-none text-zinc-900"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Area / Sector / Locality *</label>
                        <input 
                          type="text"
                          value={newAddressDetails.area}
                          onChange={(e) => setNewAddressDetails(prev => ({ ...prev, area: e.target.value }))}
                          placeholder="e.g. HSR Layout, Sector 2"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3.5 px-4 text-sm font-medium focus:bg-white focus:border-brand-primary focus:ring-4 ring-brand-primary/10 transition-all outline-none text-zinc-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nearby Landmark (Optional)</label>
                        <input 
                          type="text"
                          value={newAddressDetails.landmark}
                          onChange={(e) => setNewAddressDetails(prev => ({ ...prev, landmark: e.target.value }))}
                          placeholder="e.g. Near Apollo Hospital"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3.5 px-4 text-sm font-medium focus:bg-white focus:border-brand-primary focus:ring-4 ring-brand-primary/10 transition-all outline-none text-zinc-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 pt-2 border-t border-black/5">Save As</label>
                        <div className="flex gap-3">
                          {['Home', 'Work', 'Other'].map(label => (
                            <button
                              key={label}
                              onClick={() => setNewAddressDetails(prev => ({ ...prev, label }))}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${newAddressDetails.label === label ? 'bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/20' : 'bg-white border-zinc-200 text-zinc-600 hover:border-brand-primary/50 hover:bg-zinc-50'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <button 
                        onClick={handleSaveAddress}
                        disabled={isSavingAddress || !newAddressDetails.flat || !newAddressDetails.area}
                        className="w-full py-4 rounded-xl font-bold text-base bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20"
                      >
                        {isSavingAddress ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Proceed"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
