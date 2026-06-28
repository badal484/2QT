import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Location {
  lat: number;
  lng: number;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  current_order_id?: string | null;
  order_display_id?: string | null;
  location?: Location | null;
}

interface DispatchMapProps {
  riders: Rider[];
}

// Component to auto-fit bounds
function MapBounds({ riders }: { riders: Rider[] }) {
  const map = useMap();
  
  useEffect(() => {
    const validLocations = riders
      .filter(r => r.location && typeof r.location.lat === 'number' && typeof r.location.lng === 'number')
      .map(r => [r.location!.lat, r.location!.lng] as [number, number]);

    if (validLocations.length > 0) {
      const bounds = L.latLngBounds(validLocations);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, riders]);

  return null;
}

// Custom icons
const createIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const idleIcon = createIcon('#22c55e'); // Green
const busyIcon = createIcon('#f59e0b'); // Amber

export default function DispatchMap({ riders }: DispatchMapProps) {
  // Default center somewhere in India if no riders
  const defaultCenter: [number, number] = [28.6139, 77.2090]; 

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-zinc-800 relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full bg-zinc-900"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        {riders.map((rider) => {
          if (!rider.location) return null;
          
          const isBusy = !!rider.current_order_id;
          
          return (
            <Marker
              key={rider.id}
              position={[rider.location.lat, rider.location.lng]}
              icon={isBusy ? busyIcon : idleIcon}
            >
              <Popup className="dispatch-map-popup">
                <div className="p-1 font-sans">
                  <div className="font-bold text-sm text-black">{rider.name}</div>
                  <div className="text-xs text-gray-500 mb-1">{rider.phone}</div>
                  <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                    isBusy ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {isBusy ? `Delivering #${rider.order_display_id}` : 'Idle'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        <MapBounds riders={riders} />
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-black/80 backdrop-blur border border-white/10 rounded-xl p-3 flex flex-col gap-2 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
          <span className="text-white text-xs font-bold">Idle Riders</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
          <span className="text-white text-xs font-bold">Delivering</span>
        </div>
      </div>
    </div>
  );
}
