/**
 * Tests for the LoginPage (app/login/page.tsx).
 * LoginForm is wrapped in next/dynamic — our mock renders it async.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mockLogin = jest.fn();
jest.mock('../app/providers', () => ({
  useAuth: () => ({ login: mockLogin, user: null }),
  AuthProvider: ({ children }: any) => <>{children}</>,
  CartProvider: ({ children }: any) => <>{children}</>,
}));

jest.mock('../app/lib/api', () => ({
  api: {
    sendOtp: jest.fn().mockResolvedValue({ phone: '919999999999' }),
    verifyOtp: jest.fn().mockResolvedValue({
      user: { id: 'u-1', role: 'customer', name: 'Test User', onboarding_complete: true },
    }),
    verifyWidgetToken: jest.fn().mockResolvedValue({
      user: { id: 'u-1', role: 'customer', name: 'Test User' },
    }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'u-1', role: 'customer', name: 'Updated Name' }),
    getProfile: jest.fn().mockResolvedValue(null),
    get: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../app/lib/webPush', () => ({ registerWebPush: jest.fn() }));
jest.mock('../app/lib/socket', () => ({ initSocket: jest.fn(), getSocket: jest.fn(() => null) }));
jest.mock('../hooks/useHaptics', () => ({
  useHaptics: () => ({ tap: jest.fn(), success: jest.fn(), error: jest.fn() }),
}));

import LoginPage from '../app/login/page';
import { api } from '../app/lib/api';

// MSG91 script never loads in jsdom → widgetReady stays false → button stays disabled.
// Override Node.prototype.appendChild: when a SCRIPT is added to the DOM, immediately
// dispatch an error event on it so the onerror handler fires and widgetReady becomes true.
const origAppendChild = Node.prototype.appendChild;
beforeAll(() => {
  jest.spyOn(Node.prototype, 'appendChild').mockImplementation(function (this: Node, child: Node) {
    const result = origAppendChild.call(this, child);
    if ((child as HTMLElement).tagName === 'SCRIPT') {
      // Run AFTER the effect has set script.onerror, then dispatch the error event
      queueMicrotask(() => {
        (child as HTMLElement).dispatchEvent(new Event('error'));
      });
    }
    return result;
  });
});
afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  (api.sendOtp as jest.Mock).mockResolvedValue({ phone: '919999999999' });
  (api.verifyOtp as jest.Mock).mockResolvedValue({
    user: { id: 'u-1', role: 'customer', name: 'Test User', onboarding_complete: true },
  });
});

// ── Initial render ────────────────────────────────────────────────────────────

describe('LoginPage — initial render', () => {
  it('renders the phone step heading after dynamic resolves', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Sign in to 2QT'));
  });

  it('shows "Enter your phone number to continue" subtitle', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Enter your phone number to continue'));
  });

  it('renders the Continue button', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));
  });
});

// ── Phone validation ──────────────────────────────────────────────────────────

describe('LoginPage — phone validation', () => {
  it('does not call api.sendOtp when phone is too short', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(api.sendOtp).not.toHaveBeenCalled();
    });
  });

  it('shows an error message for short phone numbers', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => screen.getByText(/valid phone number/i));
  });
});

// ── OTP step ──────────────────────────────────────────────────────────────────

describe('LoginPage — OTP step', () => {
  it('moves to OTP step after valid phone and api.sendOtp success', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '9999999999' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Continue'));
    });

    await waitFor(() => expect(api.sendOtp).toHaveBeenCalledWith('919999999999'));
    await waitFor(() => screen.getByText('Verify your identity'));
  });

  it('shows Resend OTP button on OTP step', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '9999999999' } });

    await act(async () => { fireEvent.click(screen.getByText('Continue')); });

    await waitFor(() => screen.getByText(/Resend OTP/i));
  });

  it('shows "Use a different number" button on OTP step', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '9999999999' } });

    await act(async () => { fireEvent.click(screen.getByText('Continue')); });

    await waitFor(() => screen.getByText('Use a different number'));
  });

  it('"Use a different number" goes back to phone step', async () => {
    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '9999999999' } });

    await act(async () => { fireEvent.click(screen.getByText('Continue')); });
    await waitFor(() => screen.getByText('Use a different number'));

    fireEvent.click(screen.getByText('Use a different number'));
    await waitFor(() => screen.getByText('Sign in to 2QT'));
  });
});

// ── Onboarding step ───────────────────────────────────────────────────────────

describe('LoginPage — onboarding step', () => {
  it('moves to onboarding when user has no name', async () => {
    (api.verifyOtp as jest.Mock).mockResolvedValue({
      user: { id: 'u-2', role: 'customer', name: '2QT User', onboarding_complete: false },
    });

    render(<LoginPage />);
    await waitFor(() => screen.getByText('Continue'));

    const input = screen.getByPlaceholderText('Phone number');
    fireEvent.change(input, { target: { value: '9999999999' } });

    await act(async () => { fireEvent.click(screen.getByText('Continue')); });
    await waitFor(() => screen.getByText('Verify your identity'));

    const otpInput = screen.getByPlaceholderText('------');
    fireEvent.change(otpInput, { target: { value: '123456' } });

    await act(async () => { fireEvent.click(screen.getByText('Verify Code')); });
    await waitFor(() => screen.getByText('Welcome aboard'));
  });
});
