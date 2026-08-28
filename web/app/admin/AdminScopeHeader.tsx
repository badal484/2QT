'use client';

import React from 'react';
import { useAdminScope } from './AdminScopeContext';
import { MapPin, Store, RotateCcw, ChevronRight, Layers, Sparkles } from 'lucide-react';

export const AdminScopeHeader: React.FC = () => {
    const {
        zones,
        allKitchens,
        selectedZoneId,
        selectedKitchenId,
        activeZone,
        activeKitchen,
        setSelectedZoneId,
        setSelectedKitchenId,
        resetScope,
        loadingHierarchy
    } = useAdminScope();

    // Available kitchens filtered by selected zone
    const availableKitchens = selectedZoneId
        ? allKitchens.filter(k => k.zone_id === selectedZoneId)
        : allKitchens;

    return (
        <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shadow-lg sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left Side: Scope Title & Selector Dropdowns */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-700/60">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operational Scope</p>
                            <p className="text-sm font-bold text-slate-100 flex items-center gap-1">
                                Hierarchical Filter
                            </p>
                        </div>
                    </div>

                    {/* Zone Selector */}
                    <div className="relative flex items-center">
                        <MapPin className="w-4 h-4 absolute left-3 text-orange-400 pointer-events-none" />
                        <select
                            value={selectedZoneId || ''}
                            onChange={(e) => setSelectedZoneId(e.target.value || null)}
                            disabled={loadingHierarchy}
                            className="bg-slate-800 border border-slate-700 hover:border-orange-500 text-slate-100 text-xs font-semibold rounded-lg pl-9 pr-8 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer min-w-[160px]"
                        >
                            <option value="">🌐 All Zones (Global)</option>
                            {zones.map(zone => (
                                <option key={zone.id} value={zone.id}>
                                    📍 {zone.name} ({zone.city || 'Bengaluru'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Arrow Divider */}
                    <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:block" />

                    {/* Kitchen Selector */}
                    <div className="relative flex items-center">
                        <Store className="w-4 h-4 absolute left-3 text-emerald-400 pointer-events-none" />
                        <select
                            value={selectedKitchenId || ''}
                            onChange={(e) => setSelectedKitchenId(e.target.value || null)}
                            disabled={loadingHierarchy}
                            className="bg-slate-800 border border-slate-700 hover:border-emerald-500 text-slate-100 text-xs font-semibold rounded-lg pl-9 pr-8 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer min-w-[180px]"
                        >
                            <option value="">
                                {selectedZoneId ? '🍳 All Kitchens in Zone' : '🍳 All Kitchens'}
                            </option>
                            {availableKitchens.map(kitchen => (
                                <option key={kitchen.id} value={kitchen.id}>
                                    🍳 {kitchen.name} {kitchen.is_paused ? '(Paused)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Reset Button if filter active */}
                    {(selectedZoneId || selectedKitchenId) && (
                        <button
                            onClick={resetScope}
                            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-orange-400 bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700/50 transition"
                            title="Reset to Global Overview"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Scope</span>
                        </button>
                    )}
                </div>

                {/* Right Side: Active Scope Badge Indicator */}
                <div className="flex items-center gap-2">
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-full px-3 py-1 text-xs text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Scope:</span>
                        <span className="font-semibold text-white">
                            {activeKitchen ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                    🍳 {activeKitchen.name}
                                </span>
                            ) : activeZone ? (
                                <span className="text-orange-400 flex items-center gap-1">
                                    📍 {activeZone.name} Zone
                                </span>
                            ) : (
                                <span className="text-slate-300 flex items-center gap-1">
                                    🌐 Entire Platform (All Zones)
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
