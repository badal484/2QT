import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";

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

const defaultCenter = { lat: 28.6139, lng: 77.2090 };

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ],
};

export default function DispatchMap({ riders }: DispatchMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const isFirstRender = useRef(true);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  // Auto-fit bounds
  useEffect(() => {
    if (!map || !riders.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidLocation = false;

    riders.forEach((rider) => {
      if (rider.location && typeof rider.location.lat === "number" && typeof rider.location.lng === "number") {
        bounds.extend({ lat: rider.location.lat, lng: rider.location.lng });
        hasValidLocation = true;
      }
    });

    if (hasValidLocation) {
      if (isFirstRender.current) {
        map.fitBounds(bounds);
        isFirstRender.current = false;
      } else {
        // smooth pan to center instead of hard fitting bounds constantly
        map.panTo(bounds.getCenter());
      }
    }
  }, [map, riders]);

  if (loadError) {
    return (
      <div className="w-full h-full bg-[#0F1F18] rounded-2xl flex items-center justify-center border border-red-500/20">
        <div className="text-red-500 font-bold">Failed to load Google Maps</div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-[#0F1F18] rounded-2xl flex items-center justify-center border border-green-500/20">
        <div className="text-green-500 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-bold tracking-widest uppercase text-xs">Loading Live Map...</span>
        </div>
      </div>
    );
  }

  // Create custom marker SVG paths for Google Maps
  const createPinIcon = (color: string) => ({
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeWeight: 3,
    strokeColor: "#FFFFFF",
    scale: 10,
  });

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-zinc-800 relative z-0">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {riders.map((rider) => {
          if (!rider.location) return null;
          
          const isBusy = !!rider.current_order_id;
          
          return (
            <MarkerF
              key={rider.id}
              position={{ lat: rider.location.lat, lng: rider.location.lng }}
              icon={createPinIcon(isBusy ? "#f59e0b" : "#22c55e")}
              onClick={() => setSelectedRider(rider)}
            />
          );
        })}

        {selectedRider && selectedRider.location && (
          <InfoWindowF
            position={{ lat: selectedRider.location.lat, lng: selectedRider.location.lng }}
            onCloseClick={() => setSelectedRider(null)}
          >
            <div className="p-1 font-sans text-black">
              <div className="font-bold text-sm">{selectedRider.name}</div>
              <div className="text-xs text-gray-500 mb-1">{selectedRider.phone}</div>
              <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                selectedRider.current_order_id ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
              }`}>
                {selectedRider.current_order_id ? `Delivering #${selectedRider.order_display_id}` : 'Idle'}
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur border border-white/10 rounded-xl p-3 flex flex-col gap-2 shadow-xl">
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
