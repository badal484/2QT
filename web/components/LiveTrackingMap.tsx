"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';

// ---------- Icons ----------
const riderIcon = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#FF5722,#FF8A65);border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(255,87,34,0.5);display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.3s;">🛵</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const customerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:40px;"><svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 16 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z" fill="#10B981"/><circle cx="16" cy="15" r="6" fill="white"/></svg></div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

const kitchenIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:linear-gradient(135deg,#3B82F6,#60A5FA);border-radius:10px;border:2.5px solid white;box-shadow:0 4px 12px rgba(59,130,246,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">🍳</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// ---------- OSRM ----------
async function fetchOsrmRoute(
  kitchenLat: number, kitchenLng: number,
  customerLat: number, customerLng: number
): Promise<{ coords: [number, number][]; distance: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${kitchenLng},${kitchenLat};${customerLng},${customerLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    // OSRM gives [lng, lat]; Leaflet needs [lat, lng]
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return { coords, distance: route.distance };
  } catch {
    return null;
  }
}

// ---------- Route helpers ----------
function closestPointIndex(route: [number, number][], lat: number, lng: number): number {
  let minDist = Infinity;
  let closest = 0;
  for (let i = 0; i < route.length; i++) {
    const d = (route[i][0] - lat) ** 2 + (route[i][1] - lng) ** 2;
    if (d < minDist) { minDist = d; closest = i; }
  }
  return closest;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function remainingMeters(route: [number, number][], fromIdx: number): number {
  let total = 0;
  for (let i = fromIdx; i < route.length - 1; i++) {
    total += haversineMeters(route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]);
  }
  return total;
}

function formatETA(meters: number): string {
  // 20 km/h average delivery speed
  const mins = Math.round(meters / (20000 / 60));
  if (mins <= 0) return 'Arriving now';
  if (mins === 1) return '1 min away';
  return `${mins} min away`;
}

// ---------- Sub-components ----------
function MapFollower({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    // Only pan if the rider has actually moved meaningfully (>10m)
    if (!prev || haversineMeters(prev[0], prev[1], lat, lng) > 10) {
      map.panTo([lat, lng], { animate: true, duration: 1.2 });
      prevRef.current = [lat, lng];
    }
  }, [lat, lng, map]);
  return null;
}

function SmoothRiderMarker({
  targetLat, targetLng, onPositionChange,
}: {
  targetLat: number;
  targetLng: number;
  onPositionChange?: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const rafRef = useRef<number | null>(null);
  const currentPos = useRef({ lat: targetLat, lng: targetLng });
  const onChangRef = useRef(onPositionChange);
  onChangRef.current = onPositionChange;

  useEffect(() => {
    const animate = () => {
      if (!markerRef.current) return;
      const dLat = targetLat - currentPos.current.lat;
      const dLng = targetLng - currentPos.current.lng;
      if (Math.abs(dLat) < 0.000004 && Math.abs(dLng) < 0.000004) {
        currentPos.current = { lat: targetLat, lng: targetLng };
        markerRef.current.setLatLng([targetLat, targetLng]);
        onChangRef.current?.(targetLat, targetLng);
        return;
      }
      const f = 0.07;
      currentPos.current = {
        lat: currentPos.current.lat + dLat * f,
        lng: currentPos.current.lng + dLng * f,
      };
      markerRef.current.setLatLng([currentPos.current.lat, currentPos.current.lng]);
      onChangRef.current?.(currentPos.current.lat, currentPos.current.lng);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetLat, targetLng]);

  return (
    <Marker
      ref={markerRef}
      position={[currentPos.current.lat, currentPos.current.lng]}
      icon={riderIcon}
      zIndexOffset={1000}
    />
  );
}

// ---------- Main component ----------
interface LiveTrackingMapProps {
  kitchenLat?: number;
  kitchenLng?: number;
  customerLat?: number;
  customerLng?: number;
  initialRiderLat?: number;
  initialRiderLng?: number;
  liveRiderLat?: number | null;
  liveRiderLng?: number | null;
}

export default function LiveTrackingMap({
  kitchenLat, kitchenLng,
  customerLat, customerLng,
  initialRiderLat, initialRiderLng,
  liveRiderLat, liveRiderLng,
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [routeIdx, setRouteIdx] = useState(0);
  const [loadingRoute, setLoadingRoute] = useState(true);

  // Refs to avoid stale closures in RAF callbacks
  const routeRef = useRef<[number, number][] | null>(null);
  const prevIdxRef = useRef(-1);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!kitchenLat || !kitchenLng || !customerLat || !customerLng) {
      setLoadingRoute(false); // no coords — show fallback immediately
      return;
    }
    setLoadingRoute(true);
    fetchOsrmRoute(kitchenLat, kitchenLng, customerLat, customerLng).then((result) => {
      if (result) {
        setRoute(result.coords);
        routeRef.current = result.coords;
        setTotalDistance(result.distance);
        setEta(formatETA(result.distance));
      }
      setLoadingRoute(false);
    });
  }, [kitchenLat, kitchenLng, customerLat, customerLng]);

  // Called on every animation frame from SmoothRiderMarker — cheap: only triggers
  // React re-render when the rider crosses to the next route segment
  const handleRiderPositionChange = useCallback((lat: number, lng: number) => {
    const r = routeRef.current;
    if (!r || r.length === 0) return;
    const idx = closestPointIndex(r, lat, lng);
    if (idx !== prevIdxRef.current) {
      prevIdxRef.current = idx;
      setRouteIdx(idx);
      setEta(formatETA(remainingMeters(r, idx)));
    }
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-zinc-100 animate-pulse rounded-2xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!kitchenLat || !customerLat) {
    return (
      <div className="w-full h-full bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 text-sm">
        Map data unavailable
      </div>
    );
  }

  const currentRiderLat = liveRiderLat ?? initialRiderLat;
  const currentRiderLng = liveRiderLng ?? initialRiderLng;
  const hasRider = !!(currentRiderLat && currentRiderLng);

  const bounds = L.latLngBounds([[kitchenLat, kitchenLng!], [customerLat, customerLng!]]);
  if (hasRider) bounds.extend([currentRiderLat!, currentRiderLng!]);

  // Split route into completed (grey) and remaining (orange) segments
  const completedPath: [number, number][] = route && routeIdx > 0 ? route.slice(0, routeIdx + 1) : [];
  const remainingPath: [number, number][] = route ? route.slice(routeIdx) : [];

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">

      {/* ETA pill — top center */}
      {eta && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722] animate-pulse shrink-0" />
          {eta}
        </div>
      )}

      {/* Route distance — bottom left */}
      {totalDistance > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm text-zinc-600 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm pointer-events-none border border-zinc-100">
          {(totalDistance / 1000).toFixed(1)} km route
        </div>
      )}

      {/* Route loading spinner — top right */}
      {loadingRoute && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-medium text-zinc-500 flex items-center gap-1.5 pointer-events-none">
          <Loader2 className="w-3 h-3 animate-spin" /> Plotting route…
        </div>
      )}

      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [60, 60] }}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Kitchen pin (start) */}
        {kitchenLat && kitchenLng && (
          <Marker position={[kitchenLat, kitchenLng]} icon={kitchenIcon} />
        )}

        {/* Customer / home pin (destination) */}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon} />
        )}

        {/* Road route polylines */}
        {route ? (
          <>
            {/* Completed segment — grey, faded */}
            {completedPath.length > 1 && (
              <Polyline positions={completedPath} color="#9CA3AF" weight={5} opacity={0.45} />
            )}
            {/* Remaining segment — vivid orange */}
            {remainingPath.length > 1 && (
              <Polyline positions={remainingPath} color="#FF5722" weight={5} opacity={0.92} />
            )}
          </>
        ) : !loadingRoute ? (
          /* OSRM unavailable — fallback straight dashed line */
          <Polyline
            positions={[[kitchenLat, kitchenLng!], [customerLat, customerLng!]]}
            color="#9CA3AF"
            dashArray="8,14"
            weight={3}
            opacity={0.6}
          />
        ) : null}

        {/* Animated scooter marker */}
        {hasRider && (
          <SmoothRiderMarker
            targetLat={currentRiderLat!}
            targetLng={currentRiderLng!}
            onPositionChange={handleRiderPositionChange}
          />
        )}

        {/* Auto-pan map to follow rider on live updates */}
        {liveRiderLat != null && liveRiderLng != null && (
          <MapFollower lat={liveRiderLat} lng={liveRiderLng} />
        )}
      </MapContainer>
    </div>
  );
}
