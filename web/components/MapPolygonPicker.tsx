"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Trash2, MousePointerClick, Search, LocateFixed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icon in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPolygonPickerProps {
  polygonPoints: {lat: number, lng: number}[];
  onChange: (points: {lat: number, lng: number}[]) => void;
  defaultCenter?: [number, number];
}

export default function MapPolygonPicker({ polygonPoints = [], onChange, defaultCenter = [12.9716, 77.5946] }: MapPolygonPickerProps) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const positions = polygonPoints.map(p => [p.lat, p.lng] as [number, number]);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        onChange([...polygonPoints, { lat: e.latlng.lat, lng: e.latlng.lng }]);
      },
    });
    
    const map = useMap();
    useEffect(() => {
      setMapInstance(map);
      if (positions.length > 0 && !mapInstance) {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, [map]);
    
    return null;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': '2QTFoodPalace/1.0'
        }
      });
      const data = await res.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (mapInstance) {
          mapInstance.flyTo([lat, lon], 14, { animate: true, duration: 1.5 });
        }
      } else {
        toast.error("Location not found. Try a different search.");
      }
    } catch (err) {
      toast.error("Failed to search location");
    } finally {
      setLoading(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstance) {
          mapInstance.flyTo([latitude, longitude], 15, { animate: true, duration: 1.5 });
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        toast.error("Could not fetch location. Please use the search bar.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-zinc-700 shadow-inner group">
      
      {/* Top Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
        
        {/* Status Indicator */}
        <div className="bg-[#111]/90 backdrop-blur-md px-4 py-2.5 rounded-xl text-sm text-white font-bold flex items-center gap-3 border border-white/10 shadow-2xl pointer-events-auto">
          {polygonPoints.length === 0 ? (
              <><MousePointerClick className="w-4 h-4 text-brand-primary animate-bounce" /> Click map to draw boundary</>
          ) : (
              <><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> {polygonPoints.length} Boundary Points</>
          )}
          
          {polygonPoints.length > 0 && (
              <button 
                type="button" 
                onClick={handleClear} 
                className="ml-2 flex items-center gap-1.5 text-red-400 hover:text-white transition-colors px-2.5 py-1 bg-red-500/10 hover:bg-red-500 rounded-md uppercase tracking-widest text-[10px] font-black border border-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
          )}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="pointer-events-auto relative shadow-2xl rounded-xl overflow-hidden flex bg-[#111]/90 backdrop-blur-md border border-white/10 focus-within:border-brand-primary/50 transition-all w-[250px]">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city/area..."
            className="w-full bg-transparent py-2 pl-3 pr-2 text-xs font-medium outline-none text-white placeholder:text-zinc-500"
          />
          <button type="submit" disabled={loading} className="px-3 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center border-l border-white/10 bg-white/5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Locate Me Button */}
      <button 
        type="button"
        onClick={handleLocateMe}
        disabled={loading}
        className="absolute bottom-6 right-4 z-[1000] bg-[#111]/90 backdrop-blur-md rounded-full p-3 shadow-2xl border border-white/10 text-brand-primary transition-colors disabled:opacity-50 hover:bg-[#222]"
        title="Use Current Location"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
      </button>

      <MapContainer 
        center={positions.length > 0 ? positions[0] : defaultCenter} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', zIndex: 1, backgroundColor: '#222' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapEvents />
        {positions.length > 0 && (
          <Polygon 
            positions={positions} 
            pathOptions={{ color: '#F56A17', fillColor: '#F56A17', fillOpacity: 0.2, weight: 3 }} 
          />
        )}
        {positions.map((pos, idx) => (
            <Marker key={idx} position={pos} opacity={0.8} />
        ))}
      </MapContainer>
    </div>
  );
}
