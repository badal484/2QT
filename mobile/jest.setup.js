/* eslint-disable no-undef */

// Clean Mock Implementations without JSX to prevent Babel NativeWind transform scoping issues
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c) => c,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
  ReactNativeTracing: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
}));

jest.mock('@react-native-firebase/app', () => () => ({ apps: [] }));
jest.mock('@react-native-firebase/auth', () => () => ({
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signOut: jest.fn(),
}));
jest.mock('@react-native-firebase/messaging', () => () => ({
  getToken: jest.fn(() => Promise.resolve('mock_fcm_token')),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  setBackgroundMessageHandler: jest.fn(),
  requestPermission: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('@notifee/react-native', () => ({
  displayNotification: jest.fn(() => Promise.resolve()),
  createChannel: jest.fn(() => Promise.resolve()),
  onForegroundEvent: jest.fn(() => jest.fn()),
  onBackgroundEvent: jest.fn(),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));

jest.mock('react-native-share', () => ({
  default: { open: jest.fn(() => Promise.resolve()), shareSingle: jest.fn() },
}));

jest.mock('react-native-fast-image', () => ({
  __esModule: true,
  default: 'FastImage',
  FastImage: 'FastImage',
  resizeMode: { contain: 'contain', cover: 'cover', stretch: 'stretch', center: 'center' },
  priority: { low: 'low', normal: 'normal', high: 'high' },
  cacheControl: { immutable: 'immutable', web: 'web', cacheOnly: 'cacheOnly' },
  preload: jest.fn(),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  G: 'G',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
  Polygon: 'Polygon',
  Text: 'Text',
  TSpan: 'TSpan',
}));

jest.mock('react-native-sound', () => {
  function Sound() {}
  Sound.prototype.play = jest.fn();
  Sound.prototype.stop = jest.fn();
  Sound.prototype.release = jest.fn();
  Sound.prototype.setVolume = jest.fn();
  Sound.setCategory = jest.fn();
  Sound.IsAndroid = false;
  return Sound;
});

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getCameraPermissionStatus: jest.fn(() => 'granted'),
    requestCameraPermission: jest.fn(() => Promise.resolve('granted')),
  },
  useCameraDevice: jest.fn(() => ({ id: 'back', position: 'back' })),
  useCodeScanner: jest.fn(() => ({})),
}));

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
}));

jest.mock('@react-native-community/geolocation', () => ({
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn((success) => success({ coords: { latitude: 12.9716, longitude: 77.5946 } })),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-haptic-feedback', () => ({
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
}));

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(() => Promise.resolve({ razorpay_payment_id: 'pay_test' })),
}));

jest.mock('react-native-worklets-core', () => ({
  Worklets: {
    createRunOnJS: (fn) => fn,
    createRunOnWorklet: (fn) => fn,
  },
  createSerializable: (x) => x,
  serializableMappingCache: new Map(),
  scheduleOnUI: (fn) => fn,
  isWorkletFunction: () => false,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  runOnRuntime: (_runtime, fn) => fn,
  createWorkletRuntime: () => ({}),
  executeOnUIRuntimeSync: (fn) => fn && fn(),
  RuntimeKind: { JS: 'JS', UI: 'UI', BACKGROUND: 'BACKGROUND' },
}), { virtual: true });

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: 'SafeAreaProvider',
}));

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      replace: jest.fn(),
      reset: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: jest.fn((cb) => cb()),
    useIsFocused: jest.fn(() => true),
  };
});
