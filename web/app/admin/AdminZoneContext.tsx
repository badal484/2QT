"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";

export interface ZoneItem {
  id: string;
  name: string;
  polygon?: any;
  coordinates?: any;
  active?: boolean;
  status?: string;
  kitchen_count?: number;
  delivery_radius_km?: number;
}

interface AdminZoneContextType {
  zones: ZoneItem[];
  selectedZoneId: string; // "ALL" or zone uuid
  selectedZone: ZoneItem | null;
  setSelectedZoneId: (id: string) => void;
  loadingZones: boolean;
  reloadZones: () => Promise<void>;
}

const AdminZoneContext = createContext<AdminZoneContextType | undefined>(undefined);

const STORAGE_KEY = "2qt_admin_active_zone";

export function AdminZoneProvider({ children }: { children: React.ReactNode }) {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [selectedZoneId, setSelectedZoneIdState] = useState<string>("ALL");
  const [loadingZones, setLoadingZones] = useState(true);

  const reloadZones = useCallback(async () => {
    try {
      setLoadingZones(true);
      const res = await api.get("/admin/zones");
      const list = Array.isArray(res) ? res : res?.zones || [];
      setZones(list);

      // Verify if stored selectedZoneId still exists in list
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved && (saved === "ALL" || list.some((z: ZoneItem) => z.id === saved))) {
        setSelectedZoneIdState(saved);
      } else {
        setSelectedZoneIdState("ALL");
      }
    } catch (err) {
      console.error("Failed to load zones in AdminZoneProvider:", err);
    } finally {
      setLoadingZones(false);
    }
  }, []);

  useEffect(() => {
    reloadZones();
  }, [reloadZones]);

  const setSelectedZoneId = useCallback((id: string) => {
    setSelectedZoneIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const selectedZone = useMemo(() => {
    if (selectedZoneId === "ALL") return null;
    return zones.find(z => z.id === selectedZoneId) || null;
  }, [zones, selectedZoneId]);

  return (
    <AdminZoneContext.Provider
      value={{
        zones,
        selectedZoneId,
        selectedZone,
        setSelectedZoneId,
        loadingZones,
        reloadZones,
      }}
    >
      {children}
    </AdminZoneContext.Provider>
  );
}

export function useAdminZone() {
  const context = useContext(AdminZoneContext);
  if (!context) {
    throw new Error("useAdminZone must be used within an AdminZoneProvider");
  }
  return context;
}
