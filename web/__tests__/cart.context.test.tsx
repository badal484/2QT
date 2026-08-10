/**
 * Tests for CartProvider / useCart context (app/providers.tsx)
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('../app/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ items: [] }),
    post: jest.fn().mockResolvedValue({}),
    getProfile: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('../app/lib/webPush', () => ({ registerWebPush: jest.fn() }));
jest.mock('../hooks/useHaptics', () => ({
  useHaptics: () => ({ tap: jest.fn(), success: jest.fn(), error: jest.fn() }),
}));
jest.mock('../app/lib/socket', () => ({ initSocket: jest.fn(), getSocket: jest.fn(() => null) }));

import { CartProvider, useCart, AuthProvider } from '../app/providers';

// Clear localStorage before every test so the sync-to-localStorage effect from
// one test cannot bleed into the next test's initial cart load.
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    name: 'Biryani',
    price_paise: 15000,
    zone_id: 'zone-1',
    category: 'Main',
    ...overrides,
  };
}

// Wait for provider's async loadCart effect to finish before interacting
async function resolvedCart() {
  const hook = renderHook(() => useCart(), { wrapper });
  // CartProvider sets isLoaded=true inside the finally block of loadCart
  // Wait until context is available and initial load is done
  await waitFor(() => expect(hook.result.current).not.toBeNull());
  return hook;
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('useCart — initial state', () => {
  it('starts with empty items', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));
  });

  it('starts with total of 0', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.total).toBe(0));
  });
});

// ── addItem ───────────────────────────────────────────────────────────────────

describe('useCart — addItem', () => {
  it('adds item and total reflects price', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem()); });

    await waitFor(() => expect(result.current?.items).toHaveLength(1));
    expect(result.current?.total).toBe(15000);
  });

  it('increments quantity when same item added twice', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem()); });
    await waitFor(() => expect(result.current?.items).toHaveLength(1));

    act(() => { result.current?.addItem(makeItem()); });
    await waitFor(() => expect(result.current?.items[0].quantity).toBe(2));

    expect(result.current?.total).toBe(30000);
  });

  it('adds as separate line when customizations differ', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem({ customizations: [] })); });
    await waitFor(() => expect(result.current?.items).toHaveLength(1));

    act(() => { result.current?.addItem(makeItem({ customizations: [{ group: 'Spice', option: 'Hot', price_paise: 500 }] })); });
    await waitFor(() => expect(result.current?.items).toHaveLength(2));
  });

  it('includes base customization price in total', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => {
      result.current?.addItem(makeItem({
        id: 'item-cust',
        price_paise: 15000,
        customizations: [{ group: 'Extra', option: 'Cheese', price_paise: 2000 }],
      }));
    });

    // base 15000 + custom 2000 = 17000
    await waitFor(() => expect(result.current?.total).toBe(17000));
  });

  it('clears cart and replaces with new zone item when zones differ', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem({ id: 'item-1', zone_id: 'zone-1' })); });
    await waitFor(() => expect(result.current?.items).toHaveLength(1));

    act(() => { result.current?.addItem(makeItem({ id: 'item-2', zone_id: 'zone-2' })); });
    await waitFor(() => {
      expect(result.current?.items).toHaveLength(1);
      expect(result.current?.items[0].id).toBe('item-2');
    });
  });
});

// ── removeItem ────────────────────────────────────────────────────────────────

describe('useCart — removeItem', () => {
  it('decrements quantity when > 1', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem({ id: 'item-dec' })); });
    act(() => { result.current?.addItem(makeItem({ id: 'item-dec' })); }); // qty = 2
    await waitFor(() => expect(result.current?.items[0].quantity).toBe(2));

    const id = result.current!.items[0].cartItemId || result.current!.items[0].id!;
    act(() => { result.current?.removeItem(id); });

    await waitFor(() => expect(result.current?.items[0].quantity).toBe(1));
  });

  it('removes item completely when quantity is 1', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem({ id: 'item-rem' })); });
    await waitFor(() => expect(result.current?.items).toHaveLength(1));

    const id = result.current!.items[0].cartItemId || result.current!.items[0].id!;
    act(() => { result.current?.removeItem(id); });

    await waitFor(() => expect(result.current?.items).toHaveLength(0));
  });

  it('does nothing for an unknown id', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem()); });
    await waitFor(() => expect(result.current?.items).toHaveLength(1));

    act(() => { result.current?.removeItem('ghost-id'); });
    await waitFor(() => expect(result.current?.items).toHaveLength(1));
  });
});

// ── clearCart ─────────────────────────────────────────────────────────────────

describe('useCart — clearCart', () => {
  it('empties all items and resets total', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem({ id: 'a' })); });
    act(() => { result.current?.addItem(makeItem({ id: 'b' })); });
    await waitFor(() => expect(result.current?.items.length).toBeGreaterThan(0));

    act(() => { result.current?.clearCart(); });

    await waitFor(() => {
      expect(result.current?.items).toHaveLength(0);
      expect(result.current?.total).toBe(0);
    });
  });
});

// ── total ─────────────────────────────────────────────────────────────────────

describe('useCart — total calculation', () => {
  it('handles pricePaise field as alternate key', async () => {
    const { result } = await resolvedCart();
    await waitFor(() => expect(result.current?.items).toHaveLength(0));

    act(() => { result.current?.addItem(makeItem({ id: 'item-alt', price_paise: undefined, pricePaise: 12000 }) as any); });
    await waitFor(() => expect(result.current?.total).toBe(12000));
  });
});
