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

jest.mock('react-native-share', () => ({
  default: { open: jest.fn(() => Promise.resolve()), shareSingle: jest.fn() },
}));

jest.mock('react-native-fast-image', () => {
  const React = require('react');
  const { Image } = require('react-native');
  const FastImage = (props) => React.createElement(Image, props);
  FastImage.resizeMode = { contain: 'contain', cover: 'cover', stretch: 'stretch', center: 'center' };
  FastImage.priority = { low: 'low', normal: 'normal', high: 'high' };
  FastImage.cacheControl = { immutable: 'immutable', web: 'web', cacheOnly: 'cacheOnly' };
  FastImage.preload = jest.fn();
  return { __esModule: true, default: FastImage, FastImage };
});

jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { default: (props) => React.createElement(View, props) };
});

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
  Camera: { getCameraPermissionStatus: jest.fn(() => 'granted'), requestCameraPermission: jest.fn(() => Promise.resolve('granted')) },
  useCameraDevice: jest.fn(() => ({ id: 'back', position: 'back' })),
  useCodeScanner: jest.fn(() => ({})),
}));

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { default: (props) => React.createElement(View, props) };
});

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

jest.mock('react-native-haptic-feedback', () => ({
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
}));

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(() => Promise.resolve({ razorpay_payment_id: 'pay_test' })),
}));

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      replace: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: jest.fn((cb) => cb()),
    useIsFocused: jest.fn(() => true),
  };
});
