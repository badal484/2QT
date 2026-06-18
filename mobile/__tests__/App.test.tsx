/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children }: any) => children,
    Swipeable: ({ children }: any) => children,
    DrawerLayout: ({ children }: any) => children,
    State: {},
    NativeViewGestureHandler: ({ children }: any) => children,
    TapGestureHandler: ({ children }: any) => children,
    FlingGestureHandler: ({ children }: any) => children,
    ForceTouchGestureHandler: ({ children }: any) => children,
    LongPressGestureHandler: ({ children }: any) => children,
    PanGestureHandler: ({ children }: any) => children,
    PinchGestureHandler: ({ children }: any) => children,
    RotationGestureHandler: ({ children }: any) => children,
    RawButton: ({ children }: any) => children,
    BaseButton: ({ children }: any) => children,
    RectButton: ({ children }: any) => children,
    BorderlessButton: ({ children }: any) => children,
    TouchableOpacity: ({ children }: any) => children,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('react-native-worklets', () => {
  return {
    Worklets: {
      createRunOnJS: (fn: any) => fn,
      createRunOnWorklet: (fn: any) => fn,
    },
    createSerializable: jest.fn((x: any) => x),
    serializableMappingCache: new Map(),
    scheduleOnUI: jest.fn((fn: any) => fn),
    isWorkletFunction: jest.fn((fn: any) => typeof fn === 'function' && (fn as any).__workletHash !== undefined),
    runOnJS: jest.fn((fn: any) => fn),
    runOnUI: jest.fn((fn: any) => fn),
    runOnRuntime: jest.fn((runtime: any, fn: any) => fn),
    createWorkletRuntime: jest.fn(() => ({})),
    executeOnUIRuntimeSync: jest.fn((fn: any) => fn()),
    RuntimeKind: {
      JS: 'JS',
      UI: 'UI',
      BACKGROUND: 'BACKGROUND',
    },
  };
});

jest.mock('react-native-worklets-core', () => {
  return {
    Worklets: {
      createRunOnJS: (fn: any) => fn,
      createRunOnWorklet: (fn: any) => fn,
    },
    createSerializable: jest.fn((x: any) => x),
    serializableMappingCache: new Map(),
    scheduleOnUI: jest.fn((fn: any) => fn),
    isWorkletFunction: jest.fn((fn: any) => typeof fn === 'function' && (fn as any).__workletHash !== undefined),
    runOnJS: jest.fn((fn: any) => fn),
    runOnUI: jest.fn((fn: any) => fn),
    runOnRuntime: jest.fn((runtime: any, fn: any) => fn),
    createWorkletRuntime: jest.fn(() => ({})),
    executeOnUIRuntimeSync: jest.fn((fn: any) => fn()),
    RuntimeKind: {
      JS: 'JS',
      UI: 'UI',
      BACKGROUND: 'BACKGROUND',
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = (props: any) => <View {...props}>{props.children}</View>;
  const MockMarker = (props: any) => <View {...props}>{props.children}</View>;
  const MockPolyline = (props: any) => <View {...props}>{props.children}</View>;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn((success) => success({
    coords: {
      latitude: 37.78825,
      longitude: -122.4324,
      altitude: 0,
      accuracy: 0,
      altitudeAccuracy: 0,
      heading: 0,
      speed: 0,
    },
    timestamp: 0,
  })),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
}));

jest.mock('react-native-otp-verify', () => ({
  getHash: jest.fn(() => Promise.resolve(['hash'])),
  startOtpListener: jest.fn(),
  removeOtpListener: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
  })),
  useNetInfo: () => ({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-maps-directions', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => <View {...props} />;
});

jest.mock('react-native-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => <View {...props} />;
});

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => <View {...props} />;
});

jest.mock('lottie-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => <View {...props} />;
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

test('renders correctly', async () => {
  jest.useFakeTimers();
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    jest.runAllTimers();
  });
  jest.useRealTimers();
});
