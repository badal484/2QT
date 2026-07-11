import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Marker {
  id: string;
  lat: number;
  lng: number;
  iconUrl?: string;
}

interface RoutePoint {
  lat: number;
  lng: number;
}

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: Marker[];
  routeFrom?: RoutePoint;
  routeTo?: RoutePoint;
  onRegionChangeComplete?: (region: { latitude: number; longitude: number }) => void;
  onRegionChange?: () => void;
  style?: any;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  routeFrom,
  routeTo,
  onRegionChangeComplete,
  onRegionChange,
  style,
}) => {
  const webviewRef = useRef<WebView>(null);

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

  // Inject route update when from/to change
  useEffect(() => {
    if (!webviewRef.current) return;
    if (routeFrom && routeTo) {
      webviewRef.current.injectJavaScript(`
        if (window.updateRoute) {
          window.updateRoute(${routeFrom.lat}, ${routeFrom.lng}, ${routeTo.lat}, ${routeTo.lng});
        }
        true;
      `);
    } else {
      webviewRef.current.injectJavaScript(`
        if (window.clearRoute) { window.clearRoute(); }
        true;
      `);
    }
  }, [routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

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
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
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

        // ── Route polyline via OSRM ──────────────────────────────────────────
        var routeLayer = null;

        window.clearRoute = function() {
          if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
        };

        window.updateRoute = function(fromLat, fromLng, toLat, toLng) {
          window.clearRoute();
          var url = 'https://router.project-osrm.org/route/v1/driving/'
            + fromLng + ',' + fromLat + ';'
            + toLng + ',' + toLat
            + '?overview=full&geometries=geojson';
          fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (!data.routes || !data.routes[0]) return;
              var coords = data.routes[0].geometry.coordinates.map(function(c) {
                return [c[1], c[0]];
              });
              routeLayer = L.polyline(coords, {
                color: '#10B981',
                weight: 4,
                opacity: 0.85,
                dashArray: null,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(map);
            })
            .catch(function() {});
        };

        ${routeFrom && routeTo
          ? `window.updateRoute(${routeFrom.lat}, ${routeFrom.lng}, ${routeTo.lat}, ${routeTo.lng});`
          : ''}

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
