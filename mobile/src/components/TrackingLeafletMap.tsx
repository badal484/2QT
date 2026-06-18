import React, { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';

interface TrackingLeafletMapProps {
  riderLocation?: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number } | null;
  kitchenLocation?: { lat: number; lng: number } | null;
  riderHeading?: number;
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  style?: any;
}

export const TrackingLeafletMap: React.FC<TrackingLeafletMapProps> = ({
  riderLocation,
  customerLocation,
  kitchenLocation,
  riderHeading = 0,
  initialLat = 20.5937,
  initialLng = 78.9629,
  initialZoom = 5,
  style,
}) => {
  const webviewRef = useRef<WebView>(null);

  const inject = (js: string) => {
    webviewRef.current?.injectJavaScript(`(function(){${js}})(); true;`);
  };

  const handleLoadEnd = () => {
    if (riderLocation) {
      inject(`window.updateRider && window.updateRider(${riderLocation.lat},${riderLocation.lng},${riderHeading});`);
    }
    if (customerLocation) {
      inject(`window.updateHome && window.updateHome(${customerLocation.lat},${customerLocation.lng});`);
    }
    if (kitchenLocation) {
      inject(`window.updateKitchen && window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});`);
    }
    inject(`window.fitAll && window.fitAll();`);
  };

  useEffect(() => {
    if (!riderLocation) return;
    inject(`window.updateRider && window.updateRider(${riderLocation.lat},${riderLocation.lng},${riderHeading}); window.fitAll && window.fitAll();`);
  }, [riderLocation, riderHeading]);

  useEffect(() => {
    if (!customerLocation) return;
    inject(`window.updateHome && window.updateHome(${customerLocation.lat},${customerLocation.lng}); window.fitAll && window.fitAll();`);
  }, [customerLocation?.lat, customerLocation?.lng]);

  useEffect(() => {
    if (!kitchenLocation) return;
    inject(`window.updateKitchen && window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng}); window.fitAll && window.fitAll();`);
  }, [kitchenLocation?.lat, kitchenLocation?.lng]);

  const initKitchen = kitchenLocation
    ? `window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});`
    : '';
  const initHome = customerLocation
    ? `window.updateHome(${customerLocation.lat},${customerLocation.lng});`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body,html,#map{width:100%;height:100%;margin:0;padding:0;background:#f0ede9;}
    .leaflet-control-attribution,.leaflet-control-zoom{display:none!important;}
    @keyframes pulse{0%{transform:scale(0.5);opacity:0.9;}100%{transform:scale(2.2);opacity:0;}}
    .pulse{position:absolute;width:70px;height:70px;top:-13px;left:-13px;border-radius:50%;border:2px solid rgba(16,185,129,0.5);animation:pulse 2s ease-out infinite;}
    .hw{position:relative;display:flex;align-items:center;justify-content:center;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${initialLat},${initialLng}],${initialZoom});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);

    var riderM = null, homeM = null, kitchenM = null, routeLine = null;

    function riderIcon(hdg) {
      return L.divIcon({
        html: '<div style="transform:rotate('+hdg+'deg);width:44px;height:44px;"><svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#070F0C" stroke="#10B981" stroke-width="3"/><path d="M22 10 L30 32 L22 26 L14 32 Z" fill="#10B981"/></svg></div>',
        className:'', iconSize:[44,44], iconAnchor:[22,22]
      });
    }

    function homeIcon() {
      return L.divIcon({
        html: '<div class="hw"><div class="pulse"></div><svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#10B981" stroke="white" stroke-width="3"/><path d="M22 12 L13 20 L15 20 L15 32 L20 32 L20 26 L24 26 L24 32 L29 32 L29 20 L31 20 Z" fill="white"/></svg></div>',
        className:'', iconSize:[44,44], iconAnchor:[22,40]
      });
    }

    function kitchenIcon() {
      return L.divIcon({
        html: '<div style="width:40px;height:40px;background:#1A1F1C;border:2px solid #F97316;border-radius:10px;display:flex;align-items:center;justify-content:center;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 2v6c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V2" stroke="#F97316" stroke-width="2" stroke-linecap="round"/><path d="M12 2v8M2 22h20M6 12v10M18 12v10M12 12v10" stroke="#F97316" stroke-width="2" stroke-linecap="round"/></svg></div>',
        className:'', iconSize:[40,40], iconAnchor:[20,40]
      });
    }

    function refreshRoute() {
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (kitchenM && homeM) {
        // Static route: kitchen → customer (the full delivery path)
        routeLine = L.polyline(
          [kitchenM.getLatLng(), homeM.getLatLng()],
          {color:'#10B981', weight:4, opacity:0.5, dashArray:'12,8'}
        ).addTo(map);
      } else if (riderM && homeM) {
        // Fallback when kitchen not yet known
        routeLine = L.polyline(
          [riderM.getLatLng(), homeM.getLatLng()],
          {color:'#10B981', weight:4, opacity:0.5, dashArray:'12,8'}
        ).addTo(map);
      }
    }

    window.fitAll = function() {
      var pts = [];
      if (kitchenM) pts.push(kitchenM.getLatLng());
      if (homeM)    pts.push(homeM.getLatLng());
      if (riderM)   pts.push(riderM.getLatLng());
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), {padding:[48,48], maxZoom:16, animate:true, duration:0.8});
      } else if (pts.length === 1) {
        map.setView(pts[0], 15, {animate:true});
      }
    };

    window.updateRider = function(lat, lng, hdg) {
      if (!riderM) { riderM = L.marker([lat,lng],{icon:riderIcon(hdg),zIndexOffset:2000}).addTo(map); }
      else { riderM.setLatLng([lat,lng]); riderM.setIcon(riderIcon(hdg)); }
      refreshRoute();
    };

    window.updateHome = function(lat, lng) {
      if (!homeM) { homeM = L.marker([lat,lng],{icon:homeIcon(),zIndexOffset:1000}).addTo(map); }
      else { homeM.setLatLng([lat,lng]); }
      refreshRoute();
    };

    window.updateKitchen = function(lat, lng) {
      if (!kitchenM) { kitchenM = L.marker([lat,lng],{icon:kitchenIcon(),zIndexOffset:900}).addTo(map); }
      else { kitchenM.setLatLng([lat,lng]); }
      refreshRoute();
    };

    // Render static markers immediately
    ${initKitchen}
    ${initHome}
    window.fitAll();
  </script>
</body>
</html>`;

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
      onLoadEnd={handleLoadEnd}
      style={[{ flex: 1, backgroundColor: '#f0ede9' }, style]}
    />
  );
};
