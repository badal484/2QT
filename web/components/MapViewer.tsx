"use client";

import { useEffect, useRef } from 'react';
import { ExternalLink, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface MapViewerProps {
  lat: number;
  lng: number;
  label?: string;
  hideControls?: boolean;
}

export default function MapViewer({ lat, lng, label = "Customer Location", hideControls = false }: MapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      if (destroyed || !containerRef.current) return;

      // Always destroy any existing instance to prevent "container reused" error
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Leaflet needs the container to have a size — force it
      containerRef.current.style.height = '100%';
      containerRef.current.style.width = '100%';

      // Fix Leaflet's broken default icon paths in webpack/Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: false,
        dragging: false,
        doubleClickZoom: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      L.marker([lat, lng]).addTo(map);

      mapInstanceRef.current = map;
    }).catch(console.error);

    // Cleanup: destroy map when component unmounts or lat/lng change
    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ position: 'relative' }}>
      {/* Map div — raw Leaflet mounts here, must fill parent */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      />

      {/* Controls — only show when not in background mode */}
      {!hideControls && (
        <>
          {/* Hover overlay */}
          <div className="absolute inset-0 z-10 pointer-events-auto bg-black/0 hover:bg-black/5 transition-colors group">
            <button
              onClick={(e) => { e.stopPropagation(); openGoogleMaps(); }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-brand-primary text-white font-bold py-3 px-5 rounded-full shadow-xl flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Navigate
            </button>
          </div>

          {/* External link button */}
          <button
            onClick={(e) => { e.stopPropagation(); openGoogleMaps(); }}
            className="absolute bottom-3 right-3 z-20 bg-white text-brand-primary p-2.5 rounded-full shadow-lg border border-zinc-100 hover:bg-zinc-50 transition-colors"
            title="Open in Maps"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
