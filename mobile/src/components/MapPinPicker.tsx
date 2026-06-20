import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, Navigation, MapPin, Search, Loader } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = 160;

interface Props {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onBack: () => void;
  onSearchPress?: () => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': '2QT-App/1.0' } }
    );
    const data = await res.json();
    if (data?.display_name) {
      // Shorten: take road + suburb + city
      const a = data.address || {};
      const parts = [
        a.road || a.pedestrian || a.footway,
        a.suburb || a.neighbourhood || a.village || a.town,
        a.city || a.county,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',');
    }
  } catch {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const MAP_HTML = (lat: number, lng: number) => `
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body,html,#map{width:100%;height:100%;background:#1a1a2e}
    .leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false,tap:true}).setView([${lat},${lng}],17);
  /* Esri World Imagery — true satellite with good India coverage */
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19, attribution:''
  }).addTo(map);
  /* Street-name labels on top of satellite */
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19, attribution:''
  }).addTo(map);

  map.on('dragstart movestart', function(){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'moving'}));
  });
  map.on('moveend', function(){
    var c = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'moved',lat:c.lat,lng:c.lng}));
  });

  window.flyTo = function(lat,lng){
    map.flyTo([lat,lng],16,{animate:true,duration:0.8});
  };
</script>
</body></html>
`;

export const MapPinPicker: React.FC<Props> = ({
  initialLat = 23.637,
  initialLng = 85.52,
  onConfirm,
  onBack,
  onSearchPress,
}) => {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const webviewReady = useRef(false);
  const pendingFlyTo = useRef<{ lat: number; lng: number } | null>(null);

  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Pin bounce animation — lifts when moving, drops when stopped
  const pinY = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;

  const animatePin = useCallback((up: boolean) => {
    Animated.parallel([
      Animated.spring(pinY, {
        toValue: up ? -14 : 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.spring(shadowScale, {
        toValue: up ? 0.6 : 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
    ]).start();
  }, [pinY, shadowScale]);

  const flyToCoords = useCallback((lat: number, lng: number) => {
    if (webviewRef.current && webviewReady.current) {
      webviewRef.current.injectJavaScript(`window.flyTo(${lat},${lng}); true;`);
    } else {
      // WebView not ready yet — queue it
      pendingFlyTo.current = { lat, lng };
    }
  }, []);

  const geocodeAndSet = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    setCenter({ lat, lng });
    const a = await reverseGeocode(lat, lng);
    setAddress(a);
    setGeocoding(false);
  }, []);

  // On mount: request fresh GPS fix — maximumAge:0 forces device to get new position
  useEffect(() => {
    Geolocation.requestAuthorization();
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        flyToCoords(latitude, longitude);
        geocodeAndSet(latitude, longitude);
      },
      () => {
        // Permission denied or timeout — fall back to props passed by AddressScreen
        geocodeAndSet(initialLat, initialLng);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced reverse geocode after user pans map
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMoved = useCallback(async (lat: number, lng: number) => {
    setCenter({ lat, lng });
    setMoving(false);
    animatePin(false);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const a = await reverseGeocode(lat, lng);
      setAddress(a);
      setGeocoding(false);
    }, 400);
  }, [animatePin]);

  const flyToGPS = useCallback(() => {
    setLocating(true);
    Geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        flyToCoords(pos.coords.latitude, pos.coords.longitude);
        // Immediately start reverse-geocoding the fresh GPS position
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeocoding(true);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(a => {
          setAddress(a);
          setGeocoding(false);
        });
      },
      () => {
        setLocating(false);
        // Fallback: fly to initial prop location
        flyToCoords(initialLat, initialLng);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [flyToCoords, initialLat, initialLng]);

  return (
    <View style={styles.container}>
      {/* Map */}
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: MAP_HTML(initialLat, initialLng), baseUrl: 'https://leafletjs.com/' }}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
        onLoad={() => {
          webviewReady.current = true;
          if (pendingFlyTo.current) {
            const { lat, lng } = pendingFlyTo.current;
            webviewRef.current?.injectJavaScript(`window.flyTo(${lat},${lng}); true;`);
            pendingFlyTo.current = null;
          }
        }}
        onMessage={e => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'moving') {
              setMoving(true);
              animatePin(true);
            } else if (d.type === 'moved') {
              handleMoved(d.lat, d.lng);
            }
          } catch {}
        }}
      />

      {/* Fixed center pin */}
      <View style={styles.pinContainer} pointerEvents="none">
        <Animated.View style={{ transform: [{ translateY: pinY }] }}>
          <View style={styles.pinCircle}>
            <MapPin size={22} color="#fff" fill="#fff" />
          </View>
          <View style={styles.pinTail} />
        </Animated.View>
        <Animated.View style={[styles.pinShadow, { transform: [{ scaleX: shadowScale }] }]} />
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchBar} onPress={onSearchPress} activeOpacity={0.85}>
          <Search size={15} color={colors.inkMuted} />
          <Text style={styles.searchPlaceholder}>Search area, street or landmark…</Text>
        </TouchableOpacity>
      </View>

      {/* GPS button */}
      <TouchableOpacity
        style={[styles.gpsBtn, { bottom: BOTTOM_SHEET_HEIGHT + 16 }]}
        onPress={flyToGPS}
        disabled={locating}
        activeOpacity={0.85}
      >
        {locating
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Navigation size={18} color={colors.primary} />
        }
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.dragHandle} />

        <View style={styles.locationRow}>
          <View style={styles.locationDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locationLabel}>
              {moving ? 'Move the map to your location…' : 'Delivering to'}
            </Text>
            {geocoding ? (
              <View style={styles.skeletonRow}>
                <View style={[styles.skeleton, { width: '80%' }]} />
                <View style={[styles.skeleton, { width: '55%', marginTop: 5 }]} />
              </View>
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>{address || 'Detecting address…'}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (moving || geocoding) && styles.confirmBtnDisabled]}
          onPress={() => onConfirm(center.lat, center.lng, address)}
          activeOpacity={0.9}
          disabled={moving || geocoding}
        >
          {geocoding
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.confirmBtnText}>Confirm Location</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0ede8' },

  // Pin
  pinContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: BOTTOM_SHEET_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  pinCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pinTail: {
    width: 3, height: 10,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
  },
  pinShadow: {
    width: 16, height: 6, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center', marginTop: 2,
  },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchBar: {
    flex: 1, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchPlaceholder: {
    fontSize: 13, color: colors.inkMuted,
    fontFamily: fontFamily.medium, flex: 1,
  },

  // GPS
  gpsBtn: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 20, minHeight: BOTTOM_SHEET_HEIGHT,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e0ddd8', alignSelf: 'center', marginBottom: 16,
  },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  locationDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary, marginTop: 5,
  },
  locationLabel: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.medium, marginBottom: 3 },
  addressText: { fontSize: 14, color: colors.ink, fontFamily: fontFamily.semibold, lineHeight: 20 },
  skeletonRow: { gap: 4 },
  skeleton: { height: 12, borderRadius: 6, backgroundColor: '#ece9e4' },

  // Confirm button
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontFamily: fontFamily.bold },
});
