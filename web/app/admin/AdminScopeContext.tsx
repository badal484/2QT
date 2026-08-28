'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../lib/api';

export interface KitchenItem {
    id: string;
    zone_id: string;
    name: string;
    address?: string;
    is_paused?: boolean;
    lat?: number;
    lng?: number;
}

export interface ZoneItem {
    id: string;
    name: string;
    is_active: boolean;
    city: string;
    kitchens: KitchenItem[];
}

interface AdminScopeContextType {
    zones: ZoneItem[];
    allKitchens: KitchenItem[];
    selectedZoneId: string | null;
    selectedKitchenId: string | null;
    activeZone: ZoneItem | null;
    activeKitchen: KitchenItem | null;
    loadingHierarchy: boolean;
    setSelectedZoneId: (zoneId: string | null) => void;
    setSelectedKitchenId: (kitchenId: string | null) => void;
    resetScope: () => void;
    getScopeQueryParams: () => string;
}

const AdminScopeContext = createContext<AdminScopeContextType | undefined>(undefined);

export const AdminScopeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [zones, setZones] = useState<ZoneItem[]>([]);
    const [allKitchens, setAllKitchens] = useState<KitchenItem[]>([]);
    const [loadingHierarchy, setLoadingHierarchy] = useState(true);

    const [selectedZoneId, setSelectedZoneIdState] = useState<string | null>(null);
    const [selectedKitchenId, setSelectedKitchenIdState] = useState<string | null>(null);

    // Fetch Hierarchy Structure from Backend
    useEffect(() => {
        const fetchHierarchy = async () => {
            try {
                const data = await api.get('/admin/hierarchy');
                setZones(data.zones || []);
                setAllKitchens(data.kitchens || []);

                // Check URL params or LocalStorage for initial values
                const urlZone = searchParams?.get('zoneId');
                const urlKitchen = searchParams?.get('kitchenId');
                const localZone = typeof window !== 'undefined' ? localStorage.getItem('admin_selected_zone') : null;
                const localKitchen = typeof window !== 'undefined' ? localStorage.getItem('admin_selected_kitchen') : null;

                const initZone = urlZone || localZone || null;
                const initKitchen = urlKitchen || localKitchen || null;

                if (initZone) setSelectedZoneIdState(initZone);
                if (initKitchen) setSelectedKitchenIdState(initKitchen);
            } catch (err) {
                console.error('Failed to load admin zone hierarchy:', err);
            } finally {
                setLoadingHierarchy(false);
            }
        };

        fetchHierarchy();
    }, []);

    // Sync state to URL and LocalStorage
    const updateUrlAndStorage = (zoneId: string | null, kitchenId: string | null) => {
        if (typeof window !== 'undefined') {
            if (zoneId) localStorage.setItem('admin_selected_zone', zoneId);
            else localStorage.removeItem('admin_selected_zone');

            if (kitchenId) localStorage.setItem('admin_selected_kitchen', kitchenId);
            else localStorage.removeItem('admin_selected_kitchen');
        }

        const params = new URLSearchParams(searchParams?.toString() || '');
        if (zoneId) params.set('zoneId', zoneId);
        else params.delete('zoneId');

        if (kitchenId) params.set('kitchenId', kitchenId);
        else params.delete('kitchenId');

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
    };

    const setSelectedZoneId = (zoneId: string | null) => {
        setSelectedZoneIdState(zoneId);
        // If current kitchen doesn't belong to new zone, clear kitchen
        if (zoneId && selectedKitchenId) {
            const kitchen = allKitchens.find(k => k.id === selectedKitchenId);
            if (kitchen && kitchen.zone_id !== zoneId) {
                setSelectedKitchenIdState(null);
                updateUrlAndStorage(zoneId, null);
                return;
            }
        }
        updateUrlAndStorage(zoneId, selectedKitchenId);
    };

    const setSelectedKitchenId = (kitchenId: string | null) => {
        setSelectedKitchenIdState(kitchenId);
        if (kitchenId) {
            const kitchen = allKitchens.find(k => k.id === kitchenId);
            if (kitchen && kitchen.zone_id) {
                setSelectedZoneIdState(kitchen.zone_id);
                updateUrlAndStorage(kitchen.zone_id, kitchenId);
                return;
            }
        }
        updateUrlAndStorage(selectedZoneId, kitchenId);
    };

    const resetScope = () => {
        setSelectedZoneIdState(null);
        setSelectedKitchenIdState(null);
        updateUrlAndStorage(null, null);
    };

    const getScopeQueryParams = () => {
        const params: string[] = [];
        if (selectedKitchenId) params.push(`kitchenId=${selectedKitchenId}`);
        else if (selectedZoneId) params.push(`zoneId=${selectedZoneId}`);
        return params.length ? `?${params.join('&')}` : '';
    };

    const activeZone = zones.find(z => z.id === selectedZoneId) || null;
    const activeKitchen = allKitchens.find(k => k.id === selectedKitchenId) || null;

    return (
        <AdminScopeContext.Provider
            value={{
                zones,
                allKitchens,
                selectedZoneId,
                selectedKitchenId,
                activeZone,
                activeKitchen,
                loadingHierarchy,
                setSelectedZoneId,
                setSelectedKitchenId,
                resetScope,
                getScopeQueryParams
            }}
        >
            {children}
        </AdminScopeContext.Provider>
    );
};

export const useAdminScope = () => {
    const context = useContext(AdminScopeContext);
    if (!context) {
        throw new Error('useAdminScope must be used within an AdminScopeProvider');
    }
    return context;
};
