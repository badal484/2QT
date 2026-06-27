"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';

// ─── CSS injection for pulse ring (once per page load) ────────────────────────
let _injected = false;
function injectStyles() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes rp{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(2.4);opacity:0}}
    .rpr{position:absolute;inset:-10px;border-radius:50%;background:rgba(255,87,34,.25);animation:rp 2s ease-in-out infinite;pointer-events:none;}
  `;
  document.head.appendChild(s);
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
    - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function closestPointIndex(route: [number, number][], lat: number, lng: number): number {
  let min = Infinity, idx = 0;
  for (let i = 0; i < route.length; i++) {
    const d = (route[i][0] - lat) ** 2 + (route[i][1] - lng) ** 2;
    if (d < min) { min = d; idx = i; }
  }
  return idx;
}

function remainingMeters(route: [number, number][], fromIdx: number): number {
  let total = 0;
  for (let i = fromIdx; i < route.length - 1; i++)
    total += haversineMeters(route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]);
  return total;
}

function fmtEta(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m <= 0) return 'Arriving now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

// ─── OSRM ─────────────────────────────────────────────────────────────────────

async function fetchRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): Promise<{ coords: [number, number][]; duration: number; distance: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) return null;
    return {
      coords: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
      duration: route.duration,
      distance: route.distance,
    };
  } catch { return null; }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function makeRiderIcon(deg: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:46px;height:46px;">
      <div class="rpr"></div>
      <div style="width:46px;height:46px;background:linear-gradient(145deg,#FF5722,#FF7043);border-radius:50%;border:3px solid #fff;box-shadow:0 2px 18px rgba(255,87,34,.55);display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
          <path d="M15 6a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h5"/><path d="m9 12 2 2h5.5"/>
          <path d="M5.5 17.5 9 12V9"/><path d="M7 5h3l2 6"/>
        </svg>
      </div>
    </div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

const DEST_ICON = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:38px;height:48px;filter:drop-shadow(0 3px 8px rgba(16,185,129,.5));">
    <svg viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 0C8.507 0 0 8.507 0 19c0 14.25 19 29 19 29S38 33.25 38 19C38 8.507 29.493 0 19 0z" fill="#10B981"/>
      <circle cx="19" cy="18" r="9" fill="white"/>
      <circle cx="19" cy="18" r="5.5" fill="#10B981"/>
    </svg>
  </div>`,
  iconSize: [38, 48],
  iconAnchor: [19, 48],
});

// ─── Smart camera — only re-fits when rider moves >80 m ──────────────────────

function MapCamera({
  rLat, rLng, cLat, cLng,
}: { rLat: number; rLng: number; cLat: number; cLng: number }) {
  const map = useMap();
  const prevRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev && haversineMeters(prev[0], prev[1], rLat, rLng) < 80) return;
    prevRef.current = [rLat, rLng];
    map.fitBounds(L.latLngBounds([rLat, rLng], [cLat, cLng]), {
      padding: [72, 72],
      maxZoom: 16,
      animate: !!prev,
      duration: prev ? 1.0 : 0,
    });
  }, [rLat, rLng, cLat, cLng, map]);

  return null;
}

// ─── Animated rider marker with bearing rotation ──────────────────────────────

function RiderMarker({
  targetLat, targetLng, onPositionChange,
}: {
  targetLat: number;
  targetLng: number;
  onPositionChange?: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const raf = useRef<number | null>(null);
  const cur = useRef({ lat: targetLat, lng: targetLng });
  const prev = useRef({ lat: targetLat, lng: targetLng });
  const bear = useRef(0);
  const cbRef = useRef(onPositionChange);
  cbRef.current = onPositionChange;

  useEffect(() => {
    const d = haversineMeters(prev.current.lat, prev.current.lng, targetLat, targetLng);
    if (d > 5) {
      const newBear = calcBearing(prev.current.lat, prev.current.lng, targetLat, targetLng);
      if (Math.abs(newBear - bear.current) > 5) {
        bear.current = newBear;
        markerRef.current?.setIcon(makeRiderIcon(bear.current));
      }
    }
    prev.current = { lat: targetLat, lng: targetLng };

    if (raf.current) cancelAnimationFrame(raf.current);
    const tick = () => {
      if (!markerRef.current) return;
      const dLat = targetLat - cur.current.lat;
      const dLng = targetLng - cur.current.lng;
      if (Math.abs(dLat) < 0.0000015 && Math.abs(dLng) < 0.0000015) {
        cur.current = { lat: targetLat, lng: targetLng };
        markerRef.current.setLatLng([targetLat, targetLng]);
        cbRef.current?.(targetLat, targetLng);
        return;
      }
      cur.current = { lat: cur.current.lat + dLat * 0.09, lng: cur.current.lng + dLng * 0.09 };
      markerRef.current.setLatLng([cur.current.lat, cur.current.lng]);
      cbRef.current?.(cur.current.lat, cur.current.lng);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [targetLat, targetLng]);

  return (
    <Marker
      ref={markerRef}
      position={[cur.current.lat, cur.current.lng]}
      icon={makeRiderIcon(bear.current)}
      zIndexOffset={1000}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LiveTrackingMapProps {
  kitchenLat?: number;
  kitchenLng?: number;
  customerLat?: number;
  customerLng?: number;
  initialRiderLat?: number;
  initialRiderLng?: number;
  liveRiderLat?: number | null;
  liveRiderLng?: number | null;
  onEtaChange?: (eta: string | null) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveTrackingMap({
  kitchenLat, kitchenLng,
  customerLat, customerLng,
  initialRiderLat, initialRiderLng,
  liveRiderLat, liveRiderLng,
  onEtaChange,
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeIdx, setRouteIdx] = useState(0);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [eta, setEta] = useState<string | null>(null);

  const routeRef = useRef<[number, number][] | null>(null);
  const durRef = useRef(0);
  const distRef = useRef(0);
  const prevIdxRef = useRef(-1);
  const lastFetchPos = useRef<[number, number] | null>(null);
  const firstDone = useRef(false);

  useEffect(() => { setMounted(true); injectStyles(); }, []);
  useEffect(() => { onEtaChange?.(eta); }, [eta, onEtaChange]);

  useEffect(() => {
    if (!customerLat || !customerLng) { setLoadingRoute(false); return; }

    const rLat = liveRiderLat ?? initialRiderLat;
    const rLng = liveRiderLng ?? initialRiderLng;
    const fromLat = rLat ?? kitchenLat;
    const fromLng = rLng ?? kitchenLng;
    if (!fromLat || !fromLng) { setLoadingRoute(false); return; }

    const last = lastFetchPos.current;
    if (last && haversineMeters(last[0], last[1], fromLat, fromLng) < 100) return;
    lastFetchPos.current = [fromLat, fromLng];
    prevIdxRef.current = -1;
    if (!firstDone.current) setLoadingRoute(true);

    fetchRoute(fromLat, fromLng, customerLat, customerLng).then(res => {
      if (res) {
        routeRef.current = res.coords;
        durRef.current = res.duration;
        distRef.current = res.distance;
        setRoute(res.coords);
        setRouteIdx(0);
        setEta(fmtEta(res.duration));
      }
      if (!firstDone.current) { setLoadingRoute(false); firstDone.current = true; }
    });
  }, [liveRiderLat, liveRiderLng, initialRiderLat, initialRiderLng, kitchenLat, kitchenLng, customerLat, customerLng]);

  const onRiderMove = useCallback((lat: number, lng: number) => {
    const r = routeRef.current;
    if (!r || r.length < 2) return;
    const idx = Math.min(closestPointIndex(r, lat, lng), r.length - 2);
    if (idx === prevIdxRef.current) return;
    prevIdxRef.current = idx;
    setRouteIdx(idx);
    if (distRef.current > 0) {
      const rem = remainingMeters(r, idx);
      setEta(fmtEta((rem / distRef.current) * durRef.current));
    }
  }, []);

  // ─── Guards ──────────────────────────────────────────────────────────────

  if (!mounted) return (
    <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
    </div>
  );

  if (!customerLat || !customerLng) return (
    <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-semibold text-zinc-700">Rider is on the way</p>
      <p className="text-xs text-zinc-400">Map loading…</p>
    </div>
  );

  if (kitchenLat && kitchenLng && haversineMeters(kitchenLat, kitchenLng, customerLat, customerLng) > 500_000) return (
    <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center gap-1 text-center px-6">
      <p className="text-sm font-bold text-zinc-700">Rider is on the way</p>
      <p className="text-xs text-zinc-400">Map updating…</p>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  const riderLat = liveRiderLat ?? initialRiderLat;
  const riderLng = liveRiderLng ?? initialRiderLng;
  const hasRider = !!(riderLat && riderLng);

  const bounds = L.latLngBounds([[customerLat, customerLng]]);
  if (hasRider) bounds.extend([riderLat!, riderLng!]);
  else if (kitchenLat && kitchenLng) bounds.extend([kitchenLat, kitchenLng]);

  const traveled: [number, number][] = route ? route.slice(0, routeIdx + 1) : [];
  const remaining: [number, number][] = route ? route.slice(routeIdx) : [];

  return (
    <div className="relative w-full h-full">
      {loadingRoute && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 shadow-md pointer-events-none">
          <Loader2 className="w-3 h-3 animate-spin" /> Finding route…
        </div>
      )}

      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [72, 72] }}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />

        {/* Destination pin */}
        <Marker position={[customerLat, customerLng]} icon={DEST_ICON} />

        {/* Dashed straight line before route loads */}
        {!route && hasRider && (
          <Polyline
            positions={[[riderLat!, riderLng!], [customerLat, customerLng]]}
            color="#FF5722" dashArray="8,14" weight={3} opacity={0.5}
          />
        )}

        {/* Traveled path — faded */}
        {traveled.length > 1 && (
          <Polyline positions={traveled} color="#FF5722" weight={5} opacity={0.15} />
        )}

        {/* Remaining path — vivid */}
        {remaining.length > 1 && (
          <Polyline positions={remaining} color="#FF5722" weight={5} opacity={0.92} />
        )}

        {/* Rider marker */}
        {hasRider && (
          <RiderMarker
            targetLat={riderLat!}
            targetLng={riderLng!}
            onPositionChange={onRiderMove}
          />
        )}

        {/* Smart camera */}
        {hasRider && (
          <MapCamera rLat={riderLat!} rLng={riderLng!} cLat={customerLat} cLng={customerLng} />
        )}
      </MapContainer>
    </div>
  );
}
