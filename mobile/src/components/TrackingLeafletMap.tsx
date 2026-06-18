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
    if (riderLocation) inject(`window.updateRider && window.updateRider(${riderLocation.lat},${riderLocation.lng},${riderHeading});`);
    if (customerLocation) inject(`window.updateHome && window.updateHome(${customerLocation.lat},${customerLocation.lng});`);
    if (kitchenLocation) inject(`window.updateKitchen && window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});`);
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

  const initKitchen = kitchenLocation ? `window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});` : '';
  const initHome    = customerLocation ? `window.updateHome(${customerLocation.lat},${customerLocation.lng});` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{box-sizing:border-box;}
    body,html,#map{width:100%;height:100%;margin:0;padding:0;background:#0D1117;}
    .leaflet-control-attribution,.leaflet-control-zoom{display:none!important;}
    @keyframes pulse{0%{transform:scale(0.5);opacity:0.8;}100%{transform:scale(2.5);opacity:0;}}
    .pulse-ring{position:absolute;width:70px;height:70px;top:-13px;left:-13px;border-radius:50%;border:2px solid rgba(16,185,129,0.6);animation:pulse 2s ease-out infinite;}
    .hw{position:relative;display:flex;align-items:center;justify-content:center;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${initialLat},${initialLng}],${initialZoom});

    // Dark map tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
      maxZoom:19, subdomains:'abcd'
    }).addTo(map);

    var riderM=null, homeM=null, kitchenM=null, routeLine=null;
    var lastRouteFetch=0;

    // ── Icons ──────────────────────────────────────────────────────────────
    function riderIcon(hdg) {
      return L.divIcon({
        html: '<div style="transform:rotate('+hdg+'deg);width:52px;height:52px;">'
          +'<svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">'
          // Outer circle background
          +'<circle cx="26" cy="26" r="24" fill="#0D1117" stroke="#10B981" stroke-width="2.5"/>'
          // Rear wheel (bottom)
          +'<ellipse cx="26" cy="40" rx="5" ry="3.5" fill="#10B981" opacity="0.9"/>'
          // Body frame (elongated diamond)
          +'<path d="M26 15 L30 26 L26 37 L22 26 Z" fill="#10B981" opacity="0.85"/>'
          // Front fork (small wedge above body)
          +'<path d="M24 15 L26 11 L28 15 Z" fill="#10B981"/>'
          // Handlebar stem (vertical)
          +'<rect x="25" y="11" width="2" height="5" rx="1" fill="#10B981"/>'
          // Handlebars (horizontal bar — T-shape)
          +'<rect x="14" y="13" width="24" height="3" rx="1.5" fill="#10B981"/>'
          // Left grip (round end)
          +'<circle cx="14" cy="14.5" r="3.5" fill="#10B981"/>'
          // Right grip (round end)
          +'<circle cx="38" cy="14.5" r="3.5" fill="#10B981"/>'
          // Rider dot (seat)
          +'<circle cx="26" cy="26" r="2.5" fill="#0D1117"/>'
          +'</svg></div>',
        className:'', iconSize:[52,52], iconAnchor:[26,26]
      });
    }

    function homeIcon() {
      return L.divIcon({
        html: '<div class="hw">'
          +'<div class="pulse-ring"></div>'
          +'<svg width="46" height="46" viewBox="0 0 46 46">'
          +'<circle cx="23" cy="23" r="21" fill="#10B981" stroke="white" stroke-width="2.5"/>'
          +'<path d="M23 13 L14 21 L16 21 L16 33 L21 33 L21 27 L25 27 L25 33 L30 33 L30 21 L32 21 Z" fill="white"/>'
          +'</svg></div>',
        className:'', iconSize:[46,46], iconAnchor:[23,43]
      });
    }

    function kitchenIcon() {
      return L.divIcon({
        html: '<svg width="44" height="56" viewBox="0 0 44 56" fill="none" xmlns="http://www.w3.org/2000/svg">'
          +'<path d="M22 0C9.85 0 0 9.85 0 22C0 38.5 22 56 22 56C22 56 44 38.5 44 22C44 9.85 34.15 0 22 0Z" fill="#F97316"/>'
          +'<circle cx="22" cy="22" r="14" fill="#C2410C"/>'
          +'<path d="M15 17C14.5 15.5 15.5 14 15 12.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>'
          +'<path d="M22 16C21.5 14.5 22.5 13 22 11.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>'
          +'<path d="M29 17C28.5 15.5 29.5 14 29 12.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>'
          +'<line x1="10" y1="22" x2="34" y2="22" stroke="white" stroke-width="2.2" stroke-linecap="round"/>'
          +'<path d="M11 22C11 30.5 33 30.5 33 22" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>'
          +'<line x1="16" y1="32" x2="28" y2="32" stroke="white" stroke-width="2" stroke-linecap="round"/>'
          +'</svg>',
        className:'', iconSize:[44,56], iconAnchor:[22,56]
      });
    }

    // ── OSRM road routing ──────────────────────────────────────────────────
    function drawRoute(coords) {
      if (routeLine) { map.removeLayer(routeLine); routeLine=null; }
      if (!coords || coords.length < 2) return;
      routeLine = L.polyline(coords, {
        color:'#10B981', weight:5, opacity:0.85,
        lineJoin:'round', lineCap:'round'
      }).addTo(map);
    }

    async function fetchOSRMRoute(fromLat, fromLng, toLat, toLng) {
      var now = Date.now();
      if (now - lastRouteFetch < 8000) return; // throttle: max 1 call per 8s
      lastRouteFetch = now;
      try {
        var url = 'https://router.project-osrm.org/route/v1/driving/'
          + fromLng+','+fromLat+';'+toLng+','+toLat
          + '?overview=full&geometries=geojson';
        var resp = await fetch(url);
        var data = await resp.json();
        if (data.routes && data.routes[0]) {
          var coords = data.routes[0].geometry.coordinates.map(function(c){return[c[1],c[0]];});
          drawRoute(coords);
        }
      } catch(e) {
        // Fallback to straight line if OSRM fails
        if (riderM && homeM) drawRoute([riderM.getLatLng(), homeM.getLatLng()]);
        else if (kitchenM && homeM) drawRoute([kitchenM.getLatLng(), homeM.getLatLng()]);
      }
    }

    function refreshRoute() {
      var from = riderM ? riderM.getLatLng() : (kitchenM ? kitchenM.getLatLng() : null);
      var to   = homeM ? homeM.getLatLng() : null;
      if (from && to) {
        fetchOSRMRoute(from.lat, from.lng, to.lat, to.lng);
      }
    }

    // ── Fit bounds ──────────────────────────────────────────────────────────
    window.fitAll = function() {
      var pts = [];
      if (kitchenM) pts.push(kitchenM.getLatLng());
      if (homeM)    pts.push(homeM.getLatLng());
      if (riderM)   pts.push(riderM.getLatLng());
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), {padding:[56,56], maxZoom:16, animate:true, duration:0.8});
      } else if (pts.length === 1) {
        map.setView(pts[0], 15, {animate:true});
      }
    };

    // ── Marker update functions ─────────────────────────────────────────────
    window.updateRider = function(lat, lng, hdg) {
      if (!riderM) { riderM = L.marker([lat,lng],{icon:riderIcon(hdg),zIndexOffset:2000}).addTo(map); }
      else         { riderM.setLatLng([lat,lng]); riderM.setIcon(riderIcon(hdg)); }
      refreshRoute();
    };

    window.updateHome = function(lat, lng) {
      if (!homeM) { homeM = L.marker([lat,lng],{icon:homeIcon(),zIndexOffset:1000}).addTo(map); }
      else        { homeM.setLatLng([lat,lng]); }
      refreshRoute();
    };

    window.updateKitchen = function(lat, lng) {
      if (!kitchenM) { kitchenM = L.marker([lat,lng],{icon:kitchenIcon(),zIndexOffset:900}).addTo(map); }
      else           { kitchenM.setLatLng([lat,lng]); }
      refreshRoute();
    };

    // Init static markers
    ${initKitchen}
    ${initHome}
    window.fitAll();
  </script>
</body>
</html>`;

  return (
    <WebView
      key="tracking-map-v3"
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://leafletjs.com/' }}
      scrollEnabled={false}
      bounces={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      cacheEnabled={false}
      mixedContentMode="always"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onLoadEnd={handleLoadEnd}
      style={[{ flex: 1, backgroundColor: '#0D1117' }, style]}
    />
  );
};
