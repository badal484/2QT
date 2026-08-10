/**
 * Smoke tests for customer-role screens.
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

const customerUser = {
  id: 'c-1', name: 'Test Customer', phone: '919000000003', role: 'customer',
  kitchenId: null, kitchenName: null, zoneId: 'z-1',
  onboarding_complete: true, termsAcceptedAt: null,
};

function Wrapper({ children, user = customerUser }: { children: React.ReactNode; user?: any }) {
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

// ── ProfileScreen ─────────────────────────────────────────────────────────────

import ProfileScreen from '../src/screens/ProfileScreen';

describe('ProfileScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><ProfileScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><ProfileScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });

  it('shows "My Profile" header', () => {
    const json = createAndRender(<Wrapper><ProfileScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('My Profile');
  });

  it('shows "Invite & Earn" referral section', () => {
    const json = createAndRender(<Wrapper><ProfileScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('Invite');
  });
});

// ── LoyaltyScreen ─────────────────────────────────────────────────────────────

import LoyaltyScreen from '../src/screens/LoyaltyScreen';

describe('LoyaltyScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><LoyaltyScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><LoyaltyScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── NotificationsScreen ───────────────────────────────────────────────────────

import NotificationsScreen from '../src/screens/NotificationsScreen';

describe('NotificationsScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><NotificationsScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><NotificationsScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── WalletScreen ──────────────────────────────────────────────────────────────

import WalletScreen from '../src/screens/WalletScreen';

describe('WalletScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><WalletScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><WalletScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── FeedbackScreen ────────────────────────────────────────────────────────────

import FeedbackScreen from '../src/screens/FeedbackScreen';

const feedbackRoute = {
  params: { orderId: 'order-1', kitchenName: 'Test Kitchen', displayId: 'ORD-001' },
};

describe('FeedbackScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(
          <Wrapper><FeedbackScreen navigation={mockNav} route={feedbackRoute} /></Wrapper>,
        ),
      ).not.toThrow();
    });
  });

  it('shows "Ratings" text', () => {
    const json = createAndRender(
      <Wrapper><FeedbackScreen navigation={mockNav} route={feedbackRoute} /></Wrapper>,
    );
    expect(json).toContain('Ratings');
  });
});

// ── HelpScreen ────────────────────────────────────────────────────────────────

import HelpScreen from '../src/screens/HelpScreen';

describe('HelpScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><HelpScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><HelpScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});

// ── ReferralScreen ────────────────────────────────────────────────────────────

import ReferralScreen from '../src/screens/ReferralScreen';

describe('ReferralScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><ReferralScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('shows "Invite & Earn" heading', () => {
    const json = createAndRender(<Wrapper><ReferralScreen navigation={mockNav} /></Wrapper>);
    expect(json).toContain('Invite & Earn');
  });
});

// ── OrderHistoryScreen ────────────────────────────────────────────────────────

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    FlashList: (props: any) => React.createElement(FlatList, props),
  };
});

import OrderHistoryScreen from '../src/screens/OrderHistoryScreen';

describe('OrderHistoryScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() =>
        renderer.create(<Wrapper><OrderHistoryScreen navigation={mockNav} /></Wrapper>),
      ).not.toThrow();
    });
  });

  it('renders a non-null tree', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => { inst = renderer.create(<Wrapper><OrderHistoryScreen navigation={mockNav} /></Wrapper>); });
    expect(inst!.toJSON()).not.toBeNull();
  });
});
