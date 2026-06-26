import React, { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';

interface Props {
  riderLocation?: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number } | null;
  kitchenLocation?: { lat: number; lng: number } | null;
  riderHeading?: number;
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  onEtaUpdate?: (minutes: number) => void;
  style?: any;
}

export const TrackingLeafletMap: React.FC<Props> = ({
  riderLocation,
  customerLocation,
  kitchenLocation,
  riderHeading = 0,
  initialLat = 20.5937,
  initialLng = 78.9629,
  initialZoom = 5,
  onEtaUpdate,
  style,
}) => {
  const webviewRef = useRef<WebView>(null);

  const inject = (js: string) =>
    webviewRef.current?.injectJavaScript(`(function(){${js}})(); true;`);

  const handleLoadEnd = () => {
    if (kitchenLocation)
      inject(`window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});`);
    if (customerLocation)
      inject(`window.updateHome(${customerLocation.lat},${customerLocation.lng});`);
    if (riderLocation)
      inject(`window.updateRider(${riderLocation.lat},${riderLocation.lng},${riderHeading});`);
    else
      inject(`window.fitAll();`);
  };

  useEffect(() => {
    if (!riderLocation) return;
    inject(`window.updateRider(${riderLocation.lat},${riderLocation.lng},${riderHeading});`);
  }, [riderLocation?.lat, riderLocation?.lng, riderHeading]);

  useEffect(() => {
    if (!customerLocation) return;
    inject(`window.updateHome(${customerLocation.lat},${customerLocation.lng});`);
  }, [customerLocation?.lat, customerLocation?.lng]);

  useEffect(() => {
    if (!kitchenLocation) return;
    inject(`window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});`);
  }, [kitchenLocation?.lat, kitchenLocation?.lng]);

  const iK = kitchenLocation  ? `window.updateKitchen(${kitchenLocation.lat},${kitchenLocation.lng});`  : '';
  const iH = customerLocation ? `window.updateHome(${customerLocation.lat},${customerLocation.lng});`    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body,html,#map{width:100%;height:100%;background:#0A0F0D}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
.leaflet-tile-pane{filter:brightness(0.88) saturate(1.1)}

/* ── Rider marker ── */
.rider-wrap{position:relative;width:48px;height:48px}
.rider-pulse{position:absolute;top:50%;left:50%;width:72px;height:72px;
  border-radius:50%;background:rgba(16,185,129,0.18);
  transform:translate(-50%,-50%);
  animation:rp 2s ease-out infinite}
@keyframes rp{0%{width:48px;height:48px;opacity:1}100%{width:96px;height:96px;opacity:0}}

/* ── Customer marker pulse ── */
.home-pulse{position:absolute;top:50%;left:50%;border-radius:50%;
  border:2.5px solid rgba(16,185,129,0.7);
  transform:translate(-50%,-50%);
  animation:hp 2.2s ease-out infinite}
@keyframes hp{0%{width:46px;height:46px;opacity:1}100%{width:90px;height:90px;opacity:0}}

/* ── Route animated dash (remaining) ── */
.route-animated{stroke-dashoffset:0;animation:dash 2s linear infinite}
@keyframes dash{to{stroke-dashoffset:-30}}
</style>
</head>
<body>
<div id="map"></div>
<script>
// ── Map init ─────────────────────────────────────────────────────────────────
var map = L.map('map',{zoomControl:false,attributionControl:false,
  maxZoom:19, minZoom:4}).setView([${initialLat},${initialLng}],${initialZoom});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  maxZoom:19, subdomains:'abcd'
}).addTo(map);

// ── State ────────────────────────────────────────────────────────────────────
var riderM=null, homeM=null, kitchenM=null;
var routeCoords=[];          // [[lat,lng], ...]
var layerDone=null, layerRemain=null, layerCasing=null;
var riderPos=null, prevPos=null;
var fetchTimer=null, lastFetch=0;
var animFrame=null, animFrom=null, animTo=null, animStartT=null;
var ANIM_MS=900;
var userInteracting=false, interactTimer=null;
var currentHdg=0;

// ── Helpers ──────────────────────────────────────────────────────────────────
function deg2rad(d){return d*Math.PI/180}
function haverDist(a,b){
  var R=6371000,dLat=deg2rad(b[0]-a[0]),dLng=deg2rad(b[1]-a[1]);
  var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(deg2rad(a[0]))*Math.cos(deg2rad(b[0]))*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}
function bearing(a,b){
  var dL=deg2rad(b[1]-a[1]),cosB=Math.cos(deg2rad(b[0]));
  var y=Math.sin(dL)*cosB, x=Math.cos(deg2rad(a[0]))*Math.sin(deg2rad(b[0]))-Math.sin(deg2rad(a[0]))*cosB*Math.cos(dL);
  return(Math.atan2(y,x)*180/Math.PI+360)%360;
}
function closestIdx(lat,lng){
  var best=0,bestD=Infinity;
  for(var i=0;i<routeCoords.length;i++){
    var d=haverDist([lat,lng],routeCoords[i]);
    if(d<bestD){bestD=d;best=i;}
  }
  return best;
}

// ── Icons ────────────────────────────────────────────────────────────────────
function riderIcon(hdg){
  return L.divIcon({
    html:'<div style="transform:rotate('+hdg+'deg);position:relative;width:64px;height:64px">'
      +'<div class="rider-pulse" style="width:84px;height:84px;"></div>'
      +'<img src="https://twoqt.onrender.com/public/images/bike_handle.png?v=1" style="width:100%;height:100%;object-fit:contain;"/>'
      +'</div>',
    className:'', iconSize:[64,64], iconAnchor:[32,32]
  });
}

function homeIcon(){
  return L.divIcon({
    html:'<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center">'
      +'<div class="home-pulse" style="top:90%"></div>'
      +'<div style="width: 52px; height: 52px; background-image: url(https://twoqt.onrender.com/public/images/customer_icon.png?v=4); background-size: contain; background-repeat: no-repeat; background-position: center; z-index: 10;"></div>'
      +'</div>',
    className:'', iconSize:[52,52], iconAnchor:[26,52]
  });
}

function kitchenIcon(){
  return L.divIcon({
    html:'<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center">'
      +'<div style="width: 52px; height: 52px; background-image: url(https://twoqt.onrender.com/public/images/kitchen_icon.png?v=4); background-size: contain; background-repeat: no-repeat; background-position: center; z-index: 10;"></div>'
      +'</div>',
    className:'', iconSize:[52,52], iconAnchor:[26,52]
  });
}

// ── Route rendering ──────────────────────────────────────────────────────────
function renderRoute(splitIdx){
  // Remove old layers
  if(layerCasing){map.removeLayer(layerCasing);layerCasing=null;}
  if(layerDone)  {map.removeLayer(layerDone);  layerDone=null;}
  if(layerRemain){map.removeLayer(layerRemain);layerRemain=null;}
  if(routeCoords.length<2)return;

  var idx=splitIdx!=null?splitIdx:0;
  var done=routeCoords.slice(0,idx+1);
  var remain=routeCoords.slice(idx);

  // Casing (outline) for remaining — drawn first so it's underneath
  if(remain.length>=2){
    layerCasing=L.polyline(remain,{color:'#064e3b',weight:9,opacity:0.6,
      lineJoin:'round',lineCap:'round'}).addTo(map);
  }
  // Completed — gray, thinner, dashed
  if(done.length>=2){
    layerDone=L.polyline(done,{color:'#374151',weight:4,opacity:0.7,
      dashArray:'6 6',lineJoin:'round',lineCap:'round'}).addTo(map);
  }
  // Remaining — bright green
  if(remain.length>=2){
    layerRemain=L.polyline(remain,{color:'#10B981',weight:6,opacity:0.95,
      lineJoin:'round',lineCap:'round'}).addTo(map);
  }
  // Bring markers to front
  if(riderM)  riderM.bringToFront();
  if(homeM)   homeM.bringToFront();
  if(kitchenM)kitchenM.bringToFront();
}

// ── OSRM route fetch ─────────────────────────────────────────────────────────
function fetchRoute(fromLat,fromLng,toLat,toLng,force){
  var now=Date.now();
  if(!force&&now-lastFetch<12000)return;
  clearTimeout(fetchTimer);
  fetchTimer=setTimeout(function(){
    lastFetch=Date.now();
    var url='https://router.project-osrm.org/route/v1/driving/'
      +fromLng+','+fromLat+';'+toLng+','+toLat
      +'?overview=full&geometries=geojson';
    var done=false;
    var timeout=setTimeout(function(){
      if(!done){done=true; fallbackRoute(fromLat,fromLng,toLat,toLng);}
    },6000);
    fetch(url).then(function(r){return r.json();}).then(function(data){
      if(done)return; done=true; clearTimeout(timeout);
      if(data.routes&&data.routes[0]){
        var r=data.routes[0];
        routeCoords=r.geometry.coordinates.map(function(c){return[c[1],c[0]];});
        var etaMins=Math.max(1,Math.ceil(r.duration/60));
        sendETA(etaMins);
        if(riderPos){
          var idx=closestIdx(riderPos.lat,riderPos.lng);
          renderRoute(idx);
        } else {
          renderRoute(0);
        }
      }
    }).catch(function(){
      if(!done){done=true;clearTimeout(timeout);fallbackRoute(fromLat,fromLng,toLat,toLng);}
    });
  },200);
}

function fallbackRoute(fromLat,fromLng,toLat,toLng){
  routeCoords=[[fromLat,fromLng],[toLat,toLng]];
  renderRoute(0);
}

function sendETA(mins){
  if(window.ReactNativeWebView){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'ETA',minutes:mins}));
  }
}

// ── Smooth rider animation ────────────────────────────────────────────────────
function easeOutCubic(t){return 1-Math.pow(1-t,3);}

function animateRiderTo(lat,lng){
  if(!riderM){
    riderM=L.marker([lat,lng],{icon:riderIcon(currentHdg),zIndexOffset:3000}).addTo(map);
    return;
  }
  animFrom=riderM.getLatLng();
  animTo={lat:lat,lng:lng};
  animStartT=Date.now();
  if(animFrame)cancelAnimationFrame(animFrame);
  function step(){
    var t=Math.min((Date.now()-animStartT)/ANIM_MS,1);
    var e=easeOutCubic(t);
    riderM.setLatLng([animFrom.lat+(animTo.lat-animFrom.lat)*e,
                       animFrom.lng+(animTo.lng-animFrom.lng)*e]);
    if(t<1)animFrame=requestAnimationFrame(step);
  }
  animFrame=requestAnimationFrame(step);
}

// ── Camera follow ─────────────────────────────────────────────────────────────
function followRider(lat,lng,hdg){
  if(userInteracting)return;
  // Lookahead: project 250m ahead in heading direction
  var LOOK=0.0025;
  var hRad=deg2rad(hdg);
  var lookLat=lat+LOOK*Math.cos(hRad);
  var lookLng=lng+LOOK*Math.sin(hRad);
  var cLat=(lat*0.6+lookLat*0.4);
  var cLng=(lng*0.6+lookLng*0.4);
  map.setView([cLat,cLng],16,{animate:true,duration:1.0,easeLinearity:0.5});
}

// ── Fit all markers ──────────────────────────────────────────────────────────
window.fitAll=function(){
  var pts=[];
  if(kitchenM)pts.push(kitchenM.getLatLng());
  if(homeM)   pts.push(homeM.getLatLng());
  if(riderM)  pts.push(riderM.getLatLng());
  if(pts.length>=2){
    map.fitBounds(L.latLngBounds(pts),{padding:[64,64],maxZoom:16,animate:true,duration:0.8});
  } else if(pts.length===1){
    map.setView(pts[0],15,{animate:true});
  }
};

// ── Public update functions ──────────────────────────────────────────────────
window.updateRider=function(lat,lng,hdg){
  prevPos=riderPos;
  riderPos={lat:lat,lng:lng};

  // Compute actual movement bearing for more accurate heading
  if(prevPos){
    var moveBrng=bearing([prevPos.lat,prevPos.lng],[lat,lng]);
    var dist=haverDist([prevPos.lat,prevPos.lng],[lat,lng]);
    if(dist>3) currentHdg=moveBrng; // only update if moved >3m
  } else {
    currentHdg=hdg||0;
  }

  // Animate position
  animateRiderTo(lat,lng);

  // Update icon rotation
  if(riderM) riderM.setIcon(riderIcon(currentHdg));

  // Update route progress split
  if(routeCoords.length>=2){
    var idx=closestIdx(lat,lng);
    renderRoute(idx);
    // Refetch route every ~15 seconds when rider is moving
    fetchRoute(lat,lng,
      homeM?homeM.getLatLng().lat:lat,
      homeM?homeM.getLatLng().lng:lng,
      false);
  } else if(homeM){
    fetchRoute(lat,lng,homeM.getLatLng().lat,homeM.getLatLng().lng,true);
  }

  // Camera follow
  followRider(lat,lng,currentHdg);
};

window.updateHome=function(lat,lng){
  if(!homeM){homeM=L.marker([lat,lng],{icon:homeIcon(),zIndexOffset:1000}).addTo(map);}
  else{homeM.setLatLng([lat,lng]);}
  // Initial route: kitchen→home or rider→home
  var from=riderM?riderM.getLatLng():(kitchenM?kitchenM.getLatLng():null);
  if(from)fetchRoute(from.lat,from.lng,lat,lng,true);
};

window.updateKitchen=function(lat,lng){
  if(!kitchenM){kitchenM=L.marker([lat,lng],{icon:kitchenIcon(),zIndexOffset:900}).addTo(map);}
  else{kitchenM.setLatLng([lat,lng]);}
  // Draw initial route kitchen→home
  if(homeM&&!riderM)fetchRoute(lat,lng,homeM.getLatLng().lat,homeM.getLatLng().lng,true);
};

// ── Detect user map interaction (pause auto-follow) ──────────────────────────
map.on('dragstart zoomstart',function(){
  userInteracting=true;
  clearTimeout(interactTimer);
});
map.on('dragend zoomend',function(){
  clearTimeout(interactTimer);
  interactTimer=setTimeout(function(){userInteracting=false;},6000);
});

// ── Init ─────────────────────────────────────────────────────────────────────
${iK}
${iH}
window.fitAll();
</script>
</body>
</html>`;

  const handleMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ETA' && onEtaUpdate) onEtaUpdate(msg.minutes);
    } catch (_) {}
  };

  return (
    <WebView
      key="tracking-map-v16"
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
      onMessage={handleMessage}
      style={[{ flex: 1, backgroundColor: '#0A0F0D' }, style]}
    />
  );
};
