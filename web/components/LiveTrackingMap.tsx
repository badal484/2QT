"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';

// ---------- Icons ----------
const riderIcon = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#FF5722,#FF8A65);border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(255,87,34,0.5);display:flex;align-items:center;justify-content:center;transition:all 0.3s;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h5"/><path d="m9 12 2 2h5.5"/><path d="M5.5 17.5 9 12V9"/><path d="M7 5h3l2 6"/></svg></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const customerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:40px;"><svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 16 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z" fill="#10B981"/><circle cx="16" cy="15" r="6" fill="white"/></svg></div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});


// ---------- OSRM ----------
async function fetchOsrmRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<{ coords: [number, number][]; distance: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
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
// Keeps both rider and customer visible by re-fitting bounds whenever the rider moves >10m
function MapBoundsFitter({
  riderLat, riderLng,
  customerLat, customerLng,
}: {
  riderLat: number; riderLng: number;
  customerLat: number; customerLng: number;
}) {
  const map = useMap();
  const prevRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (!prev || haversineMeters(prev[0], prev[1], riderLat, riderLng) > 10) {
      prevRef.current = [riderLat, riderLng];
      const bounds = L.latLngBounds(
        [riderLat, riderLng],
        [customerLat, customerLng]
      );
      map.fitBounds(bounds, { padding: [70, 70], animate: true, duration: 1.2, maxZoom: 16 });
    }
  }, [riderLat, riderLng, customerLat, customerLng, map]);
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
  onEtaChange?: (eta: string | null) => void;
}

export default function LiveTrackingMap({
  kitchenLat, kitchenLng,
  customerLat, customerLng,
  initialRiderLat, initialRiderLng,
  liveRiderLat, liveRiderLng,
  onEtaChange,
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [routeIdx, setRouteIdx] = useState(0);
  const [loadingRoute, setLoadingRoute] = useState(true);

  // Refs to avoid stale closures in RAF callbacks
  const routeRef = useRef<[number, number][] | null>(null);
  const prevIdxRef = useRef(-1);
  // Where the last OSRM fetch started — used to throttle refetches
  const lastRouteFetchRef = useRef<[number, number] | null>(null);
  // Show spinner only on the very first fetch, not on live re-fetches
  const initialLoadDoneRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Bubble ETA up to the parent page so it can show it prominently in the bottom sheet
  useEffect(() => { onEtaChange?.(eta); }, [eta, onEtaChange]);

  // Re-fetch route from rider's CURRENT position → customer every time the rider
  // moves >150 m from the last fetch point.  This is what Swiggy/Zomato do:
  // the route line always starts exactly at the scooter and re-draws as the
  // rider navigates, so ETA stays accurate and the polyline never lags behind.
  useEffect(() => {
    if (!customerLat || !customerLng) {
      setLoadingRoute(false);
      return;
    }

    // Start from rider if we have a position, otherwise fall back to kitchen
    const rLat = liveRiderLat ?? initialRiderLat;
    const rLng = liveRiderLng ?? initialRiderLng;
    const fromLat = rLat ?? kitchenLat;
    const fromLng = rLng ?? kitchenLng;

    if (!fromLat || !fromLng) {
      setLoadingRoute(false);
      return;
    }

    // Throttle: skip the OSRM call if we haven't moved >50 m since last fetch
    const last = lastRouteFetchRef.current;
    if (last && haversineMeters(last[0], last[1], fromLat, fromLng) < 50) return;

    lastRouteFetchRef.current = [fromLat, fromLng];
    prevIdxRef.current = -1; // reset closest-point cursor for new route

    if (!initialLoadDoneRef.current) setLoadingRoute(true);

    fetchOsrmRoute(fromLat, fromLng, customerLat, customerLng).then((result) => {
      if (result) {
        setRoute(result.coords);
        routeRef.current = result.coords;
        setRouteIdx(0); // new route always starts at the rider's current position
        setEta(formatETA(result.distance));
      }
      if (!initialLoadDoneRef.current) {
        setLoadingRoute(false);
        initialLoadDoneRef.current = true;
      }
    });
  }, [liveRiderLat, liveRiderLng, initialRiderLat, initialRiderLng, kitchenLat, kitchenLng, customerLat, customerLng]);

  // Called on every animation frame from SmoothRiderMarker — cheap: only triggers
  // React re-render when the rider crosses to the next route segment.
  // Cap idx at route.length - 2 so remainingPath always has at least 2 points.
  const handleRiderPositionChange = useCallback((lat: number, lng: number) => {
    const r = routeRef.current;
    if (!r || r.length < 2) return;
    const raw = closestPointIndex(r, lat, lng);
    const idx = Math.min(raw, r.length - 2); // always keep ≥1 segment ahead
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

  if (!customerLat || !customerLng) {
    return (
      <div className="w-full h-full bg-zinc-50 rounded-2xl flex flex-col items-center justify-center gap-2 px-6 text-center border border-zinc-100">
        <p className="text-sm font-semibold text-zinc-700">Rider is on the way</p>
        <p className="text-xs text-zinc-400">Live map will appear shortly</p>
      </div>
    );
  }

  // Sanity check: if kitchen and delivery address are >500 km apart the
  // coordinates are stale placeholder data — show a neutral fallback rather
  // than an absurd cross-country route.
  if (kitchenLat && kitchenLng) {
    const coordDistance = haversineMeters(kitchenLat, kitchenLng, customerLat, customerLng!);
    if (coordDistance > 500_000) {
      const currentRiderLatFallback = liveRiderLat ?? initialRiderLat;
      const currentRiderLngFallback = liveRiderLng ?? initialRiderLng;
      const riderPosStr = currentRiderLatFallback
        ? `Rider at ${currentRiderLatFallback.toFixed(4)}, ${currentRiderLngFallback?.toFixed(4)}`
        : 'Rider location updating…';
      return (
        <div className="w-full h-full bg-zinc-50 rounded-2xl flex flex-col items-center justify-center gap-2 px-6 text-center border border-zinc-200">
          <p className="text-sm font-bold text-zinc-700">Rider is on the way</p>
          <p className="text-xs text-zinc-400">{riderPosStr}</p>
          <p className="text-[10px] text-zinc-300 mt-1">Map will show once address is updated</p>
        </div>
      );
    }
  }

  const currentRiderLat = liveRiderLat ?? initialRiderLat;
  const currentRiderLng = liveRiderLng ?? initialRiderLng;
  const hasRider = !!(currentRiderLat && currentRiderLng);

  // Bounds: rider + customer only — kitchen is irrelevant once out for delivery
  const bounds = L.latLngBounds([[customerLat, customerLng!]]);
  if (hasRider) bounds.extend([currentRiderLat!, currentRiderLng!]);
  else if (kitchenLat && kitchenLng) bounds.extend([kitchenLat, kitchenLng!]);

  // Route always starts at the rider's position — routeIdx advances as the
  // rider moves forward so the orange line "shrinks" from the rear in real time
  const remainingPath: [number, number][] = route ? route.slice(routeIdx) : [];

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">

      {/* Route loading indicator */}
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

        {/* Customer / home pin (destination) */}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon} />
        )}

        {/* Layer 1 — straight dashed line: always rendered immediately,
            fades once the OSRM route loads so the two don't compete */}
        {currentRiderLat && currentRiderLng && customerLat && customerLng && (
          <Polyline
            positions={[[currentRiderLat, currentRiderLng], [customerLat, customerLng]]}
            color="#FF5722"
            dashArray="6,12"
            weight={route && remainingPath.length > 1 ? 1.5 : 4}
            opacity={route && remainingPath.length > 1 ? 0.22 : 0.65}
          />
        )}

        {/* Layer 2 — OSRM road-following route on top (when available) */}
        {route && remainingPath.length > 1 && (
          <Polyline positions={remainingPath} color="#FF5722" weight={5} opacity={0.92} />
        )}

        {/* Animated scooter marker */}
        {hasRider && (
          <SmoothRiderMarker
            targetLat={currentRiderLat!}
            targetLng={currentRiderLng!}
            onPositionChange={handleRiderPositionChange}
          />
        )}

        {/* Keep both rider and customer in view — fires on initial render
            (initialRider) and every time the live position changes */}
        {currentRiderLat != null && currentRiderLng != null && (
          <MapBoundsFitter
            riderLat={currentRiderLat!}
            riderLng={currentRiderLng!}
            customerLat={customerLat!}
            customerLng={customerLng!}
          />
        )}
      </MapContainer>
    </div>
  );
}
