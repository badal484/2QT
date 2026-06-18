import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Marker {
  id: string;
  lat: number;
  lng: number;
  iconUrl?: string; // Optional custom icon URL
}

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: Marker[];
  onRegionChangeComplete?: (region: { latitude: number; longitude: number }) => void;
  onRegionChange?: () => void;
  style?: any;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  onRegionChangeComplete,
  onRegionChange,
  style,
}) => {
  const webviewRef = useRef<WebView>(null);

  // When latitude/longitude props change, fly to the new location
  useEffect(() => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (window.map) {
          window.map.flyTo([${latitude}, ${longitude}], ${zoom}, { animate: true, duration: 1 });
        }
        true;
      `);
    }
  }, [latitude, longitude, zoom]);

  // When markers change, update them
  useEffect(() => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (window.updateMarkers) {
          window.updateMarkers(${JSON.stringify(markers)});
        }
        true;
      `);
    }
  }, [markers]);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #E5E3DF; }
        .leaflet-control-attribution { display: none !important; }
        .leaflet-control-zoom { display: none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false, maxBoundsViscosity: 1.0 }).setView([${latitude}, ${longitude}], ${zoom});
        
        // Premium CartoDB Dark Matter Map Tiles!
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd'
        }).addTo(map);

        var currentMarkers = {};
        
        var defaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        window.updateMarkers = function(markers) {
          for (var id in currentMarkers) {
            map.removeLayer(currentMarkers[id]);
          }
          currentMarkers = {};
          
          markers.forEach(function(m) {
            var icon = defaultIcon;
            if (m.iconUrl) {
               icon = L.icon({
                 iconUrl: m.iconUrl,
                 iconSize: [40, 40],
                 iconAnchor: [20, 40],
               });
            }
            var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
            currentMarkers[m.id] = marker;
          });
        };

        window.updateMarkers(${JSON.stringify(markers)});

        map.on('dragstart', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'onRegionChange' }));
        });

        map.on('moveend', function() {
          var center = map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'onRegionChangeComplete',
            latitude: center.lat, 
            longitude: center.lng 
          }));
        });
      </script>
    </body>
    </html>
  `;

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://leafletjs.com/' }}
      scrollEnabled={false}
      bounces={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      mixedContentMode="always"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'onRegionChangeComplete' && onRegionChangeComplete) {
            onRegionChangeComplete({ latitude: data.latitude, longitude: data.longitude });
          } else if (data.type === 'onRegionChange' && onRegionChange) {
            onRegionChange();
          }
        } catch (e) {}
      }}
      style={[style, { flex: 1, backgroundColor: '#E5E3DF' }]}
    />
  );
};
