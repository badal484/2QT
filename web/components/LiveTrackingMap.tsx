"use client";

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';

// Custom Icons
const createIcon = (color: string, emoji: string) => L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); border: 2px solid white; font-size: 16px;">${emoji}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const riderIcon = createIcon('#FF5722', '🛵');
const customerIcon = createIcon('#10B981', '📍');
const kitchenIcon = createIcon('#3B82F6', '🍳');

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

function MapUpdater({ riderLat, riderLng }: { riderLat?: number | null, riderLng?: number | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (riderLat && riderLng) {
      map.flyTo([riderLat, riderLng], 15, { animate: true, duration: 1 });
    }
  }, [riderLat, riderLng, map]);

  return null;
}

function SmoothRiderMarker({ targetLat, targetLng }: { targetLat: number, targetLng: number }) {
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();
  const requestRef = useRef<number | null>(null);
  const currentPos = useRef<{ lat: number, lng: number }>({ lat: targetLat, lng: targetLng });

  useEffect(() => {
    map.flyTo([targetLat, targetLng], 15, { animate: true, duration: 1 });
  }, [targetLat, targetLng, map]);

  useEffect(() => {
    const animateMarker = () => {
      if (!markerRef.current) return;
      
      const latDiff = targetLat - currentPos.current.lat;
      const lngDiff = targetLng - currentPos.current.lng;
      
      // Stop animating if we're extremely close
      if (Math.abs(latDiff) < 0.00001 && Math.abs(lngDiff) < 0.00001) {
        currentPos.current = { lat: targetLat, lng: targetLng };
        markerRef.current.setLatLng([targetLat, targetLng]);
        return;
      }

      // Linear interpolation factor (speed)
      const lerpFactor = 0.05;
      
      currentPos.current = {
        lat: currentPos.current.lat + latDiff * lerpFactor,
        lng: currentPos.current.lng + lngDiff * lerpFactor
      };

      markerRef.current.setLatLng([currentPos.current.lat, currentPos.current.lng]);
      requestRef.current = requestAnimationFrame(animateMarker);
    };

    requestRef.current = requestAnimationFrame(animateMarker);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [targetLat, targetLng]);

  return <Marker ref={markerRef} position={[currentPos.current.lat, currentPos.current.lng]} icon={riderIcon} zIndexOffset={1000} />;
}

export default function LiveTrackingMap({
  kitchenLat,
  kitchenLng,
  customerLat,
  customerLng,
  initialRiderLat,
  initialRiderLng,
  liveRiderLat,
  liveRiderLng
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-full bg-zinc-100 animate-pulse rounded-2xl flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;

  // If no coordinates at all are provided, fallback
  if (!kitchenLat || !customerLat) {
    return <div className="w-full h-full bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 text-sm">Map data unavailable</div>;
  }

  // Determine current rider position
  const currentRiderLat = liveRiderLat || initialRiderLat;
  const currentRiderLng = liveRiderLng || initialRiderLng;

  // Calculate bounds to fit kitchen and customer (and rider)
  const bounds = L.latLngBounds([
    [kitchenLat, kitchenLng!],
    [customerLat, customerLng!]
  ]);
  if (currentRiderLat && currentRiderLng) {
    bounds.extend([currentRiderLat, currentRiderLng]);
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-zinc-200">
      <MapContainer 
        bounds={bounds}
        boundsOptions={{ padding: [50, 50] }}
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {kitchenLat && kitchenLng && (
          <Marker position={[kitchenLat, kitchenLng]} icon={kitchenIcon} zIndexOffset={100} />
        )}
        
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon} zIndexOffset={100} />
        )}

        {currentRiderLat && currentRiderLng && (
          <SmoothRiderMarker targetLat={currentRiderLat} targetLng={currentRiderLng} />
        )}

        {/* Draw a subtle dotted line from Kitchen to Customer */}
        {kitchenLat && customerLat && (
          <Polyline 
            positions={[[kitchenLat, kitchenLng!], [customerLat, customerLng!]]} 
            color="#9CA3AF" 
            dashArray="5, 10" 
            weight={3} 
            opacity={0.5} 
          />
        )}
      </MapContainer>
    </div>
  );
}
