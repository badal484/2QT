/**
 * Smoke tests for rider-role screens.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../src/store/slices/authSlice';
import cartReducer from '../src/store/slices/cartSlice';
import ordersReducer from '../src/store/slices/ordersSlice';
import appReducer from '../src/store/slices/appSlice';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView,
      FlatList: RN.FlatList, Image: RN.Image,
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
    FadeInDown: { duration: jest.fn().mockReturnThis(), springify: jest.fn().mockReturnThis() },
    FadeOutDown: { duration: jest.fn().mockReturnThis() },
    FadeIn: { duration: jest.fn().mockReturnThis() },
    FadeOut: { duration: jest.fn().mockReturnThis() },
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

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('../src/utils/imageKit', () => ({
  uploadToImageKit: jest.fn().mockResolvedValue('https://ik.imagekit.io/test/img.jpg'),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const riderUser = {
  id: 'r-1', name: 'Test Rider', phone: '919000000002', role: 'rider',
  kitchenId: null, kitchenName: null, zoneId: 'z-1',
  onboarding_complete: true, termsAcceptedAt: null,
  is_verified: true, is_online: false, payment_model: 'per_order' as const,
};

function Wrapper({ children, user = riderUser }: { children: React.ReactNode; user?: any }) {
  const store = configureStore({
    reducer: { auth: authReducer, cart: cartReducer, orders: ordersReducer, app: appReducer },
    preloadedState: { auth: { user, accessToken: 'tok', refreshToken: 'ref' } },
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <Provider store={store}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </Provider>
  );
}

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

function createAndRender(element: React.ReactElement): string {
  let inst: renderer.ReactTestRenderer;
  act(() => { inst = renderer.create(element); });
  return JSON.stringify(inst!.toJSON());
}

// ── EarningsScreen ────────────────────────────────────────────────────────────

import EarningsScreen from '../src/screens/EarningsScreen';

describe('EarningsScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><EarningsScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><EarningsScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });

  it('shows "Earnings" header in loading state', () => {
    const json = createAndRender(<Wrapper><EarningsScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('Earnings');
  });
});

// ── RiderHistoryScreen ────────────────────────────────────────────────────────

import RiderHistoryScreen from '../src/screens/RiderHistoryScreen';

describe('RiderHistoryScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><RiderHistoryScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><RiderHistoryScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });

  it('shows "Order History" header in loading state', () => {
    const json = createAndRender(<Wrapper><RiderHistoryScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('Order History');
  });
});

// ── PayoutsScreen ─────────────────────────────────────────────────────────────

import PayoutsScreen from '../src/screens/PayoutsScreen';

describe('PayoutsScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><PayoutsScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><PayoutsScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });

  it('shows "Payouts" header', () => {
    const json = createAndRender(<Wrapper><PayoutsScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('Payouts');
  });
});

// ── RiderMissionsScreen ───────────────────────────────────────────────────────

import RiderMissionsScreen from '../src/screens/RiderMissionsScreen';

describe('RiderMissionsScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><RiderMissionsScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('shows "Missions" header', () => {
    const json = createAndRender(<Wrapper><RiderMissionsScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('Missions');
  });
});

// ── DeliveryOTPScreen ─────────────────────────────────────────────────────────

import DeliveryOTPScreen from '../src/screens/DeliveryOTPScreen';

const deliveryRoute = {
  params: { orderId: 'order-1', displayId: 'ORD-001', customerName: 'Test Customer' },
};

describe('DeliveryOTPScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(
          <Wrapper><DeliveryOTPScreen navigation={mockNav} route={deliveryRoute} /></Wrapper>,
        ),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => {
      inst = renderer.create(
        <Wrapper><DeliveryOTPScreen navigation={mockNav} route={deliveryRoute} /></Wrapper>,
      );
    });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── CashSubmitScreen ──────────────────────────────────────────────────────────

import CashSubmitScreen from '../src/screens/CashSubmitScreen';

const cashRoute = {
  params: { orderId: 'order-1', totalPaise: 25000, displayId: 'ORD-001' },
};

describe('CashSubmitScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(
          <Wrapper><CashSubmitScreen navigation={mockNav} route={cashRoute} /></Wrapper>,
        ),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => {
      inst = renderer.create(
        <Wrapper><CashSubmitScreen navigation={mockNav} route={cashRoute} /></Wrapper>,
      );
    });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── BatchViewScreen ───────────────────────────────────────────────────────────

import BatchViewScreen from '../src/screens/BatchViewScreen';

const batchRoute = { params: { batchId: 'batch-1' } };

describe('BatchViewScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(
          <Wrapper><BatchViewScreen navigation={mockNav} route={batchRoute} /></Wrapper>,
        ),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => {
      inst = renderer.create(
        <Wrapper><BatchViewScreen navigation={mockNav} route={batchRoute} /></Wrapper>,
      );
    });
    expect(inst!.toJSON()).not.toBeNull();
  });
});
