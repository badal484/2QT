import React, { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';

interface TrackingLeafletMapProps {
  riderLocation?: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number } | null;
  riderHeading?: number;
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  style?: any;
}

export const TrackingLeafletMap: React.FC<TrackingLeafletMapProps> = ({
  riderLocation,
  customerLocation,
  riderHeading = 0,
  initialLat = 20.5937,
  initialLng = 78.9629,
  initialZoom = 5,
  style,
}) => {
  const webviewRef = useRef<WebView>(null);
  const riderRef = useRef(riderLocation);
  const headingRef = useRef(riderHeading);

  useEffect(() => { riderRef.current = riderLocation; }, [riderLocation]);
  useEffect(() => { headingRef.current = riderHeading; }, [riderHeading]);

  const inject = (js: string) => {
    webviewRef.current?.injectJavaScript(`(function(){${js}})(); true;`);
  };

  // After WebView loads, apply any rider location that arrived while it was loading
  const handleLoadEnd = () => {
    if (riderRef.current) {
      const { lat, lng } = riderRef.current;
      inject(`window.updateRider && window.updateRider(${lat}, ${lng}, ${headingRef.current});`);
    }
  };

  // Dynamic rider updates via injection
  useEffect(() => {
    if (!riderLocation) return;
    inject(`window.updateRider && window.updateRider(${riderLocation.lat}, ${riderLocation.lng}, ${riderHeading});`);
  }, [riderLocation, riderHeading]);

  // Customer location is baked into HTML (see initScript below) for instant rendering.
  // If it changes after mount (shouldn't normally happen), inject it.
  useEffect(() => {
    if (!customerLocation) return;
    inject(`window.updateHome && window.updateHome(${customerLocation.lat}, ${customerLocation.lng});`);
  }, [customerLocation?.lat, customerLocation?.lng]);

  // Embed customer pin directly into HTML so it shows without any injection delay
  const initScript = customerLocation
    ? `window.updateHome(${customerLocation.lat}, ${customerLocation.lng});`
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
    .pulse{position:absolute;width:70px;height:70px;top:-13px;left:-13px;border-radius:50%;border:2px solid rgba(27,94,70,0.45);animation:pulse 2s ease-out infinite;}
    .hw{position:relative;display:flex;align-items:center;justify-content:center;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${initialLat},${initialLng}],${initialZoom});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);

    var riderM=null,homeM=null,routeLine=null;

    function riderIcon(hdg){
      return L.divIcon({
        html:'<div style="transform:rotate('+hdg+'deg);width:44px;height:44px;"><svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#1A1F1C" stroke="white" stroke-width="3"/><path d="M22 10 L30 32 L22 26 L14 32 Z" fill="white"/></svg></div>',
        className:'',iconSize:[44,44],iconAnchor:[22,22]
      });
    }

    function homeIcon(){
      return L.divIcon({
        html:'<div class="hw"><div class="pulse"></div><svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#1B5E46" stroke="white" stroke-width="3"/><path d="M22 11C16.5 11 12 15.5 12 21C12 29 22 37 22 37C22 37 32 29 32 21C32 15.5 27.5 11 22 11ZM22 25C19.8 25 18 23.2 18 21C18 18.8 19.8 17 22 17C24.2 17 26 18.8 26 21C26 23.2 24.2 25 22 25Z" fill="white"/></svg></div>',
        className:'',iconSize:[44,44],iconAnchor:[22,22]
      });
    }

    function refreshRoute(){
      if(routeLine){map.removeLayer(routeLine);routeLine=null;}
      if(riderM&&homeM){
        routeLine=L.polyline([riderM.getLatLng(),homeM.getLatLng()],{color:'#1B5E46',weight:4,opacity:0.7,dashArray:'10,8'}).addTo(map);
      }
    }

    window.updateRider=function(lat,lng,hdg){
      if(!riderM){riderM=L.marker([lat,lng],{icon:riderIcon(hdg),zIndexOffset:1000}).addTo(map);}
      else{riderM.setLatLng([lat,lng]);riderM.setIcon(riderIcon(hdg));}
      map.panTo([lat,lng],{animate:true,duration:1.0});
      refreshRoute();
    };

    window.updateHome=function(lat,lng){
      if(!homeM){homeM=L.marker([lat,lng],{icon:homeIcon()}).addTo(map);}
      else{homeM.setLatLng([lat,lng]);}
      if(!riderM){map.setView([lat,lng],15);}
      refreshRoute();
    };

    // Render initial customer pin without any injection delay
    ${initScript}
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
