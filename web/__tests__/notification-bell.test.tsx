/**
 * Tests for the NotificationBell component (components/NotificationBell.tsx).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../app/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
  },
}));

// Default: logged-in customer
const mockUseAuth = jest.fn(() => ({ user: { id: 'u-1', role: 'customer', name: 'Test' } }));
jest.mock('../app/providers', () => ({
  useAuth: () => mockUseAuth(),
}));

import { NotificationBell } from '../components/NotificationBell';
import { api } from '../app/lib/api';

beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockResolvedValue({ notifications: [], unreadCount: 0 });
  (api.post as jest.Mock).mockResolvedValue({});
  (api.patch as jest.Mock).mockResolvedValue({});
  mockUseAuth.mockReturnValue({ user: { id: 'u-1', role: 'customer', name: 'Test' } });
});

// ── Visibility ────────────────────────────────────────────────────────────────

describe('NotificationBell — visibility', () => {
  it('renders nothing when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { container } = render(<NotificationBell />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when user role is not customer', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u-2', role: 'rider', name: 'Rider' } });
    const { container } = render(<NotificationBell />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the bell button for customer', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByRole('button', { name: /notification/i })).toBeTruthy());
  });
});

// ── Unread badge ──────────────────────────────────────────────────────────────

describe('NotificationBell — unread count badge', () => {
  it('shows no badge when unreadCount is 0', async () => {
    (api.get as jest.Mock).mockResolvedValue({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);
    await waitFor(() => screen.getByRole('button', { name: /notification/i }));
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows unread badge when unreadCount > 0', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      notifications: [{ id: 'n-1', type: 'order_confirmed', title: 'Order placed', body: 'Yum!', is_read: false, created_at: new Date().toISOString() }],
      unreadCount: 1,
    });
    render(<NotificationBell />);
    await waitFor(() => screen.getByText('1'));
  });

  it('caps badge display at 9+', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      notifications: [],
      unreadCount: 12,
    });
    render(<NotificationBell />);
    await waitFor(() => screen.getByText('9+'));
  });
});

// ── Dropdown ──────────────────────────────────────────────────────────────────

describe('NotificationBell — dropdown', () => {
  it('opens dropdown on bell click', async () => {
    render(<NotificationBell />);
    const bell = await waitFor(() => screen.getByRole('button', { name: /notification/i }));
    fireEvent.click(bell);
    await waitFor(() => screen.getByText('Notifications'));
  });

  it('shows "No notifications yet" when list is empty', async () => {
    (api.get as jest.Mock).mockResolvedValue({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);
    const bell = await waitFor(() => screen.getByRole('button', { name: /notification/i }));
    fireEvent.click(bell);
    await waitFor(() => screen.getByText('No notifications yet'));
  });

  it('renders notification titles in the list', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      notifications: [
        { id: 'n-1', type: 'order_confirmed', title: 'Order confirmed!', body: 'Your food is being prepared.', is_read: false, created_at: new Date().toISOString() },
        { id: 'n-2', type: 'order_delivered', title: 'Order delivered', body: 'Enjoy!', is_read: true, created_at: new Date().toISOString() },
      ],
      unreadCount: 1,
    });
    render(<NotificationBell />);
    const bell = await waitFor(() => screen.getByRole('button', { name: /notification/i }));
    fireEvent.click(bell);
    await waitFor(() => {
      expect(screen.getByText('Order confirmed!')).toBeTruthy();
      expect(screen.getByText('Order delivered')).toBeTruthy();
    });
  });
});

// ── Mark as read ──────────────────────────────────────────────────────────────

describe('NotificationBell — mark as read', () => {
  it('calls api.post when "Mark all read" is clicked', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      notifications: [{ id: 'n-1', type: 'order_confirmed', title: 'Hi', body: 'hello', is_read: false, created_at: new Date().toISOString() }],
      unreadCount: 1,
    });
    render(<NotificationBell />);
    const bell = await waitFor(() => screen.getByRole('button', { name: /notification/i }));
    fireEvent.click(bell);
    await waitFor(() => screen.getByText('Mark all read'));
    fireEvent.click(screen.getByText('Mark all read'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/notifications/read-all'));
  });
});

// ── timeAgo helper (inline) ───────────────────────────────────────────────────

describe('NotificationBell — timeAgo formatting', () => {
  it('shows "just now" for very recent notifications', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      notifications: [{ id: 'n-1', type: 'order_confirmed', title: 'Fresh', body: 'hello', is_read: false, created_at: new Date().toISOString() }],
      unreadCount: 1,
    });
    render(<NotificationBell />);
    const bell = await waitFor(() => screen.getByRole('button', { name: /notification/i }));
    fireEvent.click(bell);
    await waitFor(() => screen.getByText('just now'));
  });
});
