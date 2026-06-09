"use client";

import { createContext, useContext, useState, useEffect } from "react";
import "./globals.css";
import { Inter, Outfit } from "next/font/google";
import { Metadata } from "next";
import { Toaster } from "sonner";
import { api } from "./lib/api";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

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
        
        // Refresh from server if token exists
        if (token) {
          try {
            const data = await api.getProfile();
            if (data?.user) {
              login(data.user);
            }
          } catch (serverErr) {
            console.warn("Failed to refresh user profile from server");
            // Don't auto-logout here, might just be network error
          }
        }
      } catch (e) {
        console.error("localStorage access denied or parse error", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Fallback just in case
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const login = (userData: any) => {
    setUser(userData);
    try {
      localStorage.setItem("2qt_user", JSON.stringify(userData));
    } catch (e) {}
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

interface CartItem {
  id: string;
  name: string;
  price_paise: number;
  quantity: number;
  category: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
}

// Cart Context
const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("2qt_cart");
      if (savedCart) {
        setItems(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error("Failed to parse cart from local storage", e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("2qt_cart", JSON.stringify(items));
      } catch (e) {
        console.error("Failed to save cart to local storage", e);
      }
    }
  }, [items, isLoaded]);

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + (item.price_paise * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#18181b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 selection:bg-swish-green/20">
        <AuthProvider>
          <CartProvider>
            {children}
            <Toaster position="top-center" richColors />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
