"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "./lib/api";

const webQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      placeholderData: (prev: any) => prev,
    },
  },
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const login = (userData: any) => {
    setUser(userData);
    try { localStorage.setItem("2qt_user", JSON.stringify(userData)); } catch {}
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("2qt_user");
    localStorage.removeItem("2qt_token");
    localStorage.removeItem("2qt_refresh_token");
    localStorage.removeItem("2qt_cart");
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const saved = localStorage.getItem("2qt_user");
        const token = localStorage.getItem("2qt_token");
        if (saved) {
          setUser(JSON.parse(saved));
        }
        if (token) {
          try {
            const data = await api.getProfile();
            if (data?.user) login(data.user);
          } catch {
            console.warn("Failed to refresh user profile from server");
          }
        }
      } catch (e) {
        console.error("localStorage access denied or parse error", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && ['rider', 'rider_captain'].includes(user.role)) {
      const path = window.location.pathname;
      if (!path.startsWith('/rider')) {
        window.location.href = '/rider';
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

import { useHaptics } from "../hooks/useHaptics";

interface CartItem {
  cartItemId?: string;
  id?: string; // Maps to menuItemId
  menuItemId?: string;
  name: string;
  price_paise?: number;
  pricePaise?: number;
  quantity: number;
  category?: string;
  zone_id?: string;
  customizations?: { group: string; option: string; photo_url?: string; price_paise?: number }[];
  instructions?: string;
  photo_url?: string;
  photoUrl?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const haptics = useHaptics();
  
  // NOTE: We cannot call useAuth here because CartProvider is inside AuthProvider in Providers tree,
  // but we can listen to the token in localStorage.
  const token = typeof window !== 'undefined' ? localStorage.getItem("2qt_token") : null;

  useEffect(() => {
    const loadCart = async () => {
      try {
        if (token) {
           const res = await api.get("/customers/cart");
           if (res.items && res.items.length > 0) {
             setItems(res.items.map((i: any) => ({
               ...i,
               id: i.id || i.menuItemId,
               price_paise: i.price_paise || i.pricePaise,
               photo_url: i.photo_url || i.photoUrl
             })));
           } else {
             const saved = localStorage.getItem("2qt_cart");
             if (saved) setItems(JSON.parse(saved));
           }
        } else {
           const saved = localStorage.getItem("2qt_cart");
           if (saved) setItems(JSON.parse(saved));
        }
      } catch {
        const saved = localStorage.getItem("2qt_cart");
        if (saved) setItems(JSON.parse(saved));
      } finally {
        setIsLoaded(true);
      }
    };
    loadCart();
  }, [token]);

  useEffect(() => {
    if (isLoaded) {
      try { localStorage.setItem("2qt_cart", JSON.stringify(items)); } catch {}
      if (token) {
        // Sync with cloud
        api.post("/customers/cart/sync", { items }).catch(() => {});
      }
    }
  }, [items, isLoaded, token]);

  const addItem = (item: Omit<CartItem, "quantity">) => {
    haptics.tap();
    setItems(prev => {
      if (prev.length > 0 && prev[0].zone_id && item.zone_id && prev[0].zone_id !== item.zone_id) {
        toast.error("Cart cleared because you added an item from a different delivery zone!");
        return [{ ...item, quantity: 1, cartItemId: `${item.id}-${Date.now()}` }];
      }
      
      const cartItemId = item.cartItemId || `${item.id}-${Date.now()}`;
      
      const existing = prev.find(i => 
        (i.id === item.id || i.id === item.menuItemId || i.menuItemId === item.id) && 
        JSON.stringify(i.customizations || []) === JSON.stringify(item.customizations || []) &&
        (i.instructions || '') === (item.instructions || '')
      );
      
      if (existing) return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, id: item.id || item.menuItemId, quantity: 1, cartItemId }];
    });
  };

  const removeItem = (idOrCartItemId: string) => {
    haptics.tap();
    setItems(prev => {
      const existing = prev.find(i => (i.cartItemId || i.id) === idOrCartItemId);
      if (existing && existing.quantity > 1) return prev.map(i => i === existing ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => (i.cartItemId || i.id) !== idOrCartItemId);
    });
  };

  const clearCart = () => setItems([]);
  const total = items.reduce((sum, i) => {
    const customCost = (i.customizations || []).reduce((cSum, c: any) => cSum + (c.price_paise || 0), 0);
    return sum + ((i.price_paise || i.pricePaise || 0) + customCost) * i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

// ─── Root Providers ───────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={webQueryClient}>
      <AuthProvider>
        <CartProvider>
          {children}
          <Toaster position="top-right" richColors />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
