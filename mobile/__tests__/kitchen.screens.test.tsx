/**
 * Smoke tests for kitchen-role screens.
 * Wraps each screen in a minimal Redux store + QueryClient to satisfy
 * useSelector / useQuery hooks without hitting native modules.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

// ── Slice reducers (no redux-persist here) ────────────────────────────────────
import authReducer from '../src/store/slices/authSlice';
import cartReducer from '../src/store/slices/cartSlice';
import ordersReducer from '../src/store/slices/ordersSlice';
import appReducer from '../src/store/slices/appSlice';

// ── Common mocks ──────────────────────────────────────────────────────────────

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      ScrollView: RN.ScrollView,
      FlatList: RN.FlatList,
      Image: RN.Image,
      createAnimatedComponent: jest.fn((c: any) => c),
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((v: any) => v),
    withSpring: jest.fn((v: any) => v),
    withRepeat: jest.fn((v: any) => v),
    withDelay: jest.fn((_: any, v: any) => v),
    withSequence: jest.fn((v: any) => v),
    Easing: { linear: jest.fn((v: any) => v), ease: jest.fn((v: any) => v), in: jest.fn((e: any) => e), out: jest.fn((e: any) => e) },
    FadeInDown: { duration: jest.fn().mockReturnThis(), springify: jest.fn().mockReturnThis(), delay: jest.fn().mockReturnThis() },
    FadeOutDown: { duration: jest.fn().mockReturnThis(), delay: jest.fn().mockReturnThis() },
    FadeIn: { duration: jest.fn().mockReturnThis(), delay: jest.fn().mockReturnThis() },
    FadeOut: { duration: jest.fn().mockReturnThis(), delay: jest.fn().mockReturnThis() },
    interpolate: jest.fn((v: any) => v),
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend' },
    runOnJS: jest.fn((fn: any) => fn),
    runOnUI: jest.fn((fn: any) => fn),
    useAnimatedScrollHandler: jest.fn(() => () => {}),
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mock = React.forwardRef((props: any, ref: any) =>
    React.createElement(View, { ...props, ref }),
  );
  return {
    __esModule: true,
    default: mock, Svg: mock, Path: mock, G: mock, Circle: mock, Rect: mock,
    Line: mock, Polyline: mock, Polygon: mock, Text: mock, TSpan: mock,
    Defs: mock, LinearGradient: mock, Stop: mock, ClipPath: mock,
  };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = (props: any) => React.createElement(View, props);
  return new Proxy({}, { get: () => Icon });
});

jest.mock('../src/components/ui/internal/PressableScale', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    PressableScale: ({ children, style, ...rest }: any) =>
      React.createElement(View, { style, ...rest }, children),
  };
});

jest.mock('../src/api/client', () => ({
  api: {
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
  APP_VERSION: '1.0.0',
}));

jest.mock('../src/socket/client', () => ({
  getSocket: jest.fn(() => null),
  connectSocket: jest.fn(),
  disconnectSocket: jest.fn(),
}));

jest.mock('../src/utils/kitchenAlert', () => ({
  playKitchenAlert: jest.fn(),
}));

jest.mock('../src/utils/haptics', () => ({
  haptics: { selection: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(), impact: jest.fn() },
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => ({ showDialog: jest.fn(), showToast: jest.fn() }),
  FeedbackProvider: ({ children }: any) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeStore = (preloaded: Record<string, any> = {}) =>
  configureStore({
    reducer: { auth: authReducer, cart: cartReducer, orders: ordersReducer, app: appReducer },
    preloadedState: preloaded,
  });

const kitchenUser = {
  id: 'k-1', name: 'Kitchen Staff', phone: '919000000001', role: 'kitchen',
  kitchenId: 'kz-1', kitchenName: 'Test Kitchen', zoneId: 'z-1',
  onboarding_complete: true, termsAcceptedAt: null,
};

function Wrapper({ children, user = null }: { children: React.ReactNode; user?: any }) {
  const store = makeStore({ auth: { user, accessToken: 'tok', refreshToken: 'ref' } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <Provider store={store}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </Provider>
  );
}

function createAndRender(element: React.ReactElement): string {
  let inst: renderer.ReactTestRenderer;
  act(() => { inst = renderer.create(element); });
  return JSON.stringify(inst!.toJSON());
}

// ── KitchenBoardScreen ────────────────────────────────────────────────────────

import KitchenBoardScreen from '../src/screens/KitchenBoardScreen';

describe('KitchenBoardScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper user={kitchenUser}><KitchenBoardScreen /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper user={kitchenUser}><KitchenBoardScreen /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── KitchenManageScreen ───────────────────────────────────────────────────────

import KitchenManageScreen from '../src/screens/KitchenManageScreen';

describe('KitchenManageScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper user={kitchenUser}><KitchenManageScreen /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper user={kitchenUser}><KitchenManageScreen /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── PackerScreen ──────────────────────────────────────────────────────────────

import PackerScreen from '../src/screens/PackerScreen';

describe('PackerScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper user={kitchenUser}><PackerScreen /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper user={kitchenUser}><PackerScreen /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── StockScreen ───────────────────────────────────────────────────────────────

import StockScreen from '../src/screens/StockScreen';

describe('StockScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper user={kitchenUser}><StockScreen /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper user={kitchenUser}><StockScreen /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── LiveKitchenScreen ─────────────────────────────────────────────────────────

import LiveKitchenScreen from '../src/screens/LiveKitchenScreen';

describe('LiveKitchenScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper user={kitchenUser}><LiveKitchenScreen /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('shows "2QT Primary Kitchen" in the hardcoded live panel', () => {
    const json = createAndRender(<Wrapper user={kitchenUser}><LiveKitchenScreen /></Wrapper>);
    expect(json).toContain('2QT Primary Kitchen');
  });
});
