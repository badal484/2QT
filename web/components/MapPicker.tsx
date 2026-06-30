"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2, LocateFixed, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../app/lib/api';

// Fix for default marker icon in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
  onLocationSelect: (details: { area: string; landmark?: string; lat: number; lng: number }) => void;
  defaultCenter?: [number, number];
}

function MapEvents({ setPosition, reverseGeocode, setMapInstance }: any) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    },
  });

  const map = useMap();
  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);

  return null;
}

export default function MapPicker({ onLocationSelect, defaultCenter }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(defaultCenter ?? null);
  const [gpsLoading, setGpsLoading] = useState(!defaultCenter);
  const [loading, setLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const markerRef = useRef<L.Marker>(null);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const data = await api.get(`/menu/geocode/reverse?lat=${lat}&lng=${lng}`);

      if (data && data.display_name) {
        // Our backend now returns a formatted Google Maps address as display_name
        const area = data.display_name.split(',').slice(0, 2).join(', ');
        
        onLocationSelect({
          area,
          landmark: '',
          lat,
          lng
        });
      }
    } catch (err) {
      console.error("Geocoding error", err);
    } finally {
      setLoading(false);
    }
  }, [onLocationSelect]);


  // On mount: if a center was provided use it; otherwise ask the browser for GPS.
  // Falls back to a generic subcontinent center if GPS is denied or unavailable.
  useEffect(() => {
    if (defaultCenter) {
      reverseGeocode(defaultCenter[0], defaultCenter[1]);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPosition([20, 78]);
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude]);
        setGpsLoading(false);
        reverseGeocode(coords.latitude, coords.longitude);
      },
      () => {
        setPosition([20, 78]);
        setGpsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition([latlng.lat, latlng.lng]);
          reverseGeocode(latlng.lat, latlng.lng);
        }
      },
    }),
    [reverseGeocode]
  );


  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        if (mapInstance) {
          mapInstance.flyTo([latitude, longitude], 16, { animate: true, duration: 1.5 });
        }
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location permission denied");
        } else if (err.code === err.TIMEOUT) {
          toast.error("Location request timed out. Please drag the pin manually.");
        } else {
          toast.error("Could not fetch location. Please drag the pin manually.");
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const data = await api.get(`/menu/geocode/search?q=${encodeURIComponent(searchQuery)}`);

      if (data && data.length > 0) {
        // Google places autocomplete doesn't return lat/lon directly in predictions, 
        // but for this quick fix let's assume we can notify the user to drop the pin near their city
        toast.info(`Found: ${data[0].display_name}. Please drag the pin manually.`);
        if (data[0].lat && data[0].lng && mapInstance) {
          const lat = Number(data[0].lat);
          const lng = Number(data[0].lng);
          mapInstance.flyTo([lat, lng], 15, { animate: true, duration: 1.5 });
          setPosition([lat, lng]);
          reverseGeocode(lat, lng);
        }
      } else {
        toast.error("Location not found. Try a different search.");
      }
    } catch (err) {
      console.error("Search error", err);
      toast.error("Failed to search location");
    } finally {
      setLoading(false);
    }
  };

  // Show GPS-detecting spinner while waiting for the initial location
  if (gpsLoading || !position) {
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-zinc-200 shadow-inner flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs font-medium">Detecting location…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
      {loading && (
        <div className="absolute top-2 right-2 z-[1000] bg-white rounded-full p-2 shadow-lg">
          <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
        </div>
      )}

      {/* Search Bar Overlay */}
      <div className="absolute top-2 left-2 right-12 z-[1000]">
        <form onSubmit={handleSearch} className="relative shadow-sm rounded-lg overflow-hidden flex bg-white/95 backdrop-blur-sm border border-zinc-200 focus-within:ring-2 ring-brand-primary/20 transition-all">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search location..."
            className="w-full bg-transparent py-2 pl-3 pr-2 text-xs font-medium outline-none text-zinc-900 placeholder:text-zinc-500"
          />
          <button type="submit" disabled={loading} className="px-3 text-zinc-400 hover:text-brand-primary transition-colors disabled:opacity-50 flex items-center justify-center border-l border-zinc-200">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Locate Me Button */}
      <button
        onClick={handleLocateMe}
        disabled={loading}
        className="absolute bottom-4 right-4 z-[1000] bg-white rounded-full p-3 shadow-lg hover:bg-zinc-50 border border-zinc-200 text-brand-primary transition-colors disabled:opacity-50"
        title="Use Current Location"
      >
        <LocateFixed className="w-5 h-5" />
      </button>

      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        <MapEvents setPosition={setPosition} reverseGeocode={reverseGeocode} setMapInstance={setMapInstance} />
        <Marker
          draggable={true}
          eventHandlers={eventHandlers}
          position={position}
          ref={markerRef}
        >
        </Marker>
      </MapContainer>
    </div>
  );
}
