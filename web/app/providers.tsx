"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { Toaster } from "sonner";
import { api } from "./lib/api";

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

  const login = (userData: any) => {
    setUser(userData);
    try { localStorage.setItem("2qt_user", JSON.stringify(userData)); } catch {}
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("2qt_user");
    localStorage.removeItem("2qt_token");
    localStorage.removeItem("2qt_refresh_token");
  };

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
  id: string;
  name: string;
  price_paise: number;
  quantity: number;
  category: string;
  zone_id?: string;
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem("2qt_cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try { localStorage.setItem("2qt_cart", JSON.stringify(items)); } catch {}
    }
  }, [items, isLoaded]);

  const addItem = (item: Omit<CartItem, "quantity">) => {
    haptics.tap();
    setItems(prev => {
      if (prev.length > 0 && prev[0].zone_id && item.zone_id && prev[0].zone_id !== item.zone_id) {
        toast.error("Cart cleared because you added an item from a different delivery zone!");
        return [{ ...item, quantity: 1 }];
      }
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    haptics.tap();
    setItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing && existing.quantity > 1) return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearCart = () => setItems([]);
  const total = items.reduce((sum, i) => sum + i.price_paise * i.quantity, 0);

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
    <AuthProvider>
      <CartProvider>
        {children}
        <Toaster position="top-center" richColors />
      </CartProvider>
    </AuthProvider>
  );
}
