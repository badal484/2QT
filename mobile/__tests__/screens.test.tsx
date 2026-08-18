/**
 * Smoke tests for simple mobile screens.
 * Uses react-test-renderer (already in devDeps) without @testing-library/react-native.
 * IMPORTANT: wrap renderer.create() in act() so layout effects flush before toJSON().
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

// ── Common mocks ──────────────────────────────────────────────────────────────

jest.mock('../src/components/ui/internal/PressableScale', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    PressableScale: ({ children, style, ...rest }: any) =>
      React.createElement(View, { style, ...rest }, children),
  };
});

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mock = React.forwardRef((props: any, ref: any) =>
    React.createElement(View, { ...props, ref }),
  );
  return {
    __esModule: true,
    default: mock,
    Svg: mock, Path: mock, G: mock, Circle: mock, Rect: mock,
    Line: mock, Polyline: mock, Polygon: mock, Text: mock, TSpan: mock,
  };
});

jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => ({ showDialog: jest.fn(), showToast: jest.fn() }),
  FeedbackProvider: ({ children }: any) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function createAndRender(element: React.ReactElement): string {
  let inst: renderer.ReactTestRenderer;
  act(() => {
    inst = renderer.create(element);
  });
  return JSON.stringify(inst!.toJSON());
}

// ── ForceUpdateScreen ─────────────────────────────────────────────────────────

import ForceUpdateScreen from '../src/screens/ForceUpdateScreen';

describe('ForceUpdateScreen', () => {
  it('renders without crashing', () => {
    act(() => {
      expect(() => renderer.create(<ForceUpdateScreen />)).not.toThrow();
    });
  });

  it('contains "Time to Upgrade" title', () => {
    const json = createAndRender(<ForceUpdateScreen />);
    expect(json).toContain('Time to Upgrade');
  });

  it('contains "Update Now" button text', () => {
    const json = createAndRender(<ForceUpdateScreen />);
    expect(json).toContain('Update Now');
  });

  it('contains "Critical Update" badge text', () => {
    const json = createAndRender(<ForceUpdateScreen />);
    expect(json).toContain('Critical Update');
  });

  it('matches snapshot', () => {
    let inst: renderer.ReactTestRenderer;
    act(() => {
      inst = renderer.create(<ForceUpdateScreen />);
    });
    expect(inst!.toJSON()).toMatchSnapshot();
  });
});

