"use client";

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface RiderLiveMapProps {
  riderLat: number;
  riderLng: number;
  destLat?: number;
  destLng?: number;
  destType?: 'kitchen' | 'customer';
}

const PULSE_CSS = `
  .rdot { position:relative; width:56px; height:56px; display:flex; align-items:center; justify-content:center; }
  .rdot-core { width:14px; height:14px; background:#FF5722; border-radius:50%; border:3px solid white; box-shadow:0 0 14px rgba(255,87,34,0.9); position:relative; z-index:3; }
  .rring { position:absolute; border-radius:50%; border:2px solid rgba(255,87,34,0.45); animation:riderPulse 2.8s ease-out infinite; }
  .rring1 { width:26px; height:26px; animation-delay:0s; }
  .rring2 { width:42px; height:42px; animation-delay:0.7s; }
  .rring3 { width:56px; height:56px; animation-delay:1.4s; }
  @keyframes riderPulse { 0%{opacity:.9;transform:scale(.7)} 100%{opacity:0;transform:scale(1.1)} }
`;

export default function RiderLiveMap({ riderLat, riderLng, destLat, destLng, destType }: RiderLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<any>(null);
  const riderRef    = useRef<any>(null);
  const destRef     = useRef<any>(null);
  const routeRef    = useRef<any>(null);
  const LRef        = useRef<any>(null);
  const prevRider   = useRef({ lat: riderLat, lng: riderLng });

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let dead = false;

    import('leaflet').then(L => {
      if (dead || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(containerRef.current, {
        center: [riderLat, riderLng],
        zoom: 15,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        attributionControl: false,
      });

      // Dark premium tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Rider dot with pulse rings
      const icon = L.divIcon({
        className: '',
        html: `<div class="rdot"><div class="rring rring1"></div><div class="rring rring2"></div><div class="rring rring3"></div><div class="rdot-core"></div></div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      riderRef.current = L.marker([riderLat, riderLng], { icon, zIndexOffset: 1000 }).addTo(map);
      mapRef.current = map;
    });

    return () => {
      dead = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      riderRef.current = null; routeRef.current = null; destRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update rider position (no map re-create) ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !riderRef.current) return;
    riderRef.current.setLatLng([riderLat, riderLng]);
    const prev = prevRider.current;
    const moved = Math.abs(prev.lat - riderLat) + Math.abs(prev.lng - riderLng);
    if (moved > 0.0004 && !destLat) {
      mapRef.current.panTo([riderLat, riderLng], { animate: true, duration: 1 });
      prevRider.current = { lat: riderLat, lng: riderLng };
    }
  }, [riderLat, riderLng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw / update route when destination changes ───────────────────────────
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    const L = LRef.current;

    // Clear previous
    if (routeRef.current) { routeRef.current.remove(); routeRef.current = null; }
    if (destRef.current)  { destRef.current.remove();  destRef.current  = null; }

    if (!destLat || !destLng) {
      mapRef.current.setView([riderLat, riderLng], 15, { animate: true });
      return;
    }

    // Destination marker
    const isKitchen = destType === 'kitchen';
    const bg     = isKitchen ? '#3B82F6' : '#10B981';
    const radius = isKitchen ? '10px' : '50%';
    // Inline SVG icons — no emoji dependency
    const svgIcon = isKitchen
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    const dIcon = L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;background:${bg};border-radius:${radius};border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">${svgIcon}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    destRef.current = L.marker([destLat, destLng], { icon: dIcon }).addTo(mapRef.current);

    // Fit map to show both rider and destination
    const bounds = L.latLngBounds([[riderLat, riderLng], [destLat, destLng]]);
    mapRef.current.fitBounds(bounds, { padding: [80, 100], animate: true, maxZoom: 16 });

    // Fetch OSRM road route
    const color = isKitchen ? '#3B82F6' : '#FF5722';
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${riderLng},${riderLat};${destLng},${destLat}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) }
    )
      .then(r => r.json())
      .then(data => {
        if (!mapRef.current || !data.routes?.[0]) return;
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
        routeRef.current = L.polyline(coords, { color, weight: 5, opacity: 0.9 }).addTo(mapRef.current);
      })
      .catch(() => {
        if (!mapRef.current) return;
        routeRef.current = L.polyline([[riderLat, riderLng], [destLat, destLng]], {
          color, weight: 4, opacity: 0.6, dashArray: '8 14',
        }).addTo(mapRef.current);
      });
  }, [destLat, destLng, destType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />
      <div ref={containerRef} className="absolute inset-0" style={{ zIndex: 1 }} />
    </>
  );
}
