// Cart price calculation logic — mirrors what CartScreen and CheckoutScreen do
// before calling the backend's /payment/create-order endpoint.

interface CartItem {
  menuItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
}

function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

function calcItemTotal(item: CartItem): number {
  return item.pricePaise * item.quantity;
}

function incrementQty(items: CartItem[], menuItemId: string): CartItem[] {
  return items.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + 1 } : i);
}

function decrementQty(items: CartItem[], menuItemId: string): CartItem[] {
  return items
    .map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i)
    .filter(i => i.quantity > 0);
}

function removeItem(items: CartItem[], menuItemId: string): CartItem[] {
  return items.filter(i => i.menuItemId !== menuItemId);
}

describe('Cart subtotal calculation', () => {
  it('calculates subtotal for a single item', () => {
    const items = [{ menuItemId: 'i1', name: 'Biryani', pricePaise: 15000, quantity: 1 }];
    expect(calcSubtotal(items)).toBe(15000);
  });

  it('multiplies price by quantity', () => {
    const items = [{ menuItemId: 'i1', name: 'Roti', pricePaise: 2500, quantity: 4 }];
    expect(calcSubtotal(items)).toBe(10000);
  });

  it('sums multiple items correctly', () => {
    const items = [
      { menuItemId: 'i1', name: 'Biryani', pricePaise: 15000, quantity: 2 },
      { menuItemId: 'i2', name: 'Raita',   pricePaise: 3000,  quantity: 1 },
    ];
    expect(calcSubtotal(items)).toBe(33000); // 2×₹150 + ₹30
  });

  it('returns 0 for empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it('handles large quantities without overflow', () => {
    const items = [{ menuItemId: 'i1', name: 'Item', pricePaise: 50000, quantity: 20 }];
    expect(calcSubtotal(items)).toBe(1000000); // ₹10,000
  });
});

describe('Item total calculation', () => {
  it('returns price × quantity', () => {
    const item = { menuItemId: 'i1', name: 'Dal', pricePaise: 8000, quantity: 3 };
    expect(calcItemTotal(item)).toBe(24000);
  });

  it('returns 0 paise for quantity 0', () => {
    const item = { menuItemId: 'i1', name: 'Dal', pricePaise: 8000, quantity: 0 };
    expect(calcItemTotal(item)).toBe(0);
  });
});

describe('formatPaise', () => {
  it('formats paise to rupees with ₹ symbol', () => {
    expect(formatPaise(15000)).toBe('₹150');
  });

  it('formats zero paise as ₹0', () => {
    expect(formatPaise(0)).toBe('₹0');
  });

  it('formats odd paise amounts (rounds to integer)', () => {
    expect(formatPaise(10050)).toBe('₹101'); // 100.50 → rounds to 101
  });

  it('formats large amounts correctly', () => {
    expect(formatPaise(100000)).toBe('₹1000');
  });
});

describe('Cart item quantity management', () => {
  const initialCart: CartItem[] = [
    { menuItemId: 'i1', name: 'Biryani', pricePaise: 15000, quantity: 2 },
    { menuItemId: 'i2', name: 'Roti',    pricePaise: 2500,  quantity: 1 },
  ];

  it('increments quantity of the right item', () => {
    const result = incrementQty(initialCart, 'i1');
    expect(result.find(i => i.menuItemId === 'i1')?.quantity).toBe(3);
    expect(result.find(i => i.menuItemId === 'i2')?.quantity).toBe(1); // unchanged
  });

  it('does not mutate original array', () => {
    incrementQty(initialCart, 'i1');
    expect(initialCart[0].quantity).toBe(2);
  });

  it('decrements quantity', () => {
    const result = decrementQty(initialCart, 'i1');
    expect(result.find(i => i.menuItemId === 'i1')?.quantity).toBe(1);
  });

  it('removes item when quantity reaches 0', () => {
    const result = decrementQty(initialCart, 'i2'); // i2 has qty 1
    expect(result.find(i => i.menuItemId === 'i2')).toBeUndefined();
    expect(result).toHaveLength(1);
  });

  it('removes item from cart by ID', () => {
    const result = removeItem(initialCart, 'i1');
    expect(result).toHaveLength(1);
    expect(result[0].menuItemId).toBe('i2');
  });

  it('removing non-existent item leaves cart unchanged', () => {
    const result = removeItem(initialCart, 'ghost');
    expect(result).toHaveLength(2);
  });
});

describe('Cart empty state detection', () => {
  it('detects empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it('detects non-empty cart', () => {
    const items = [{ menuItemId: 'i1', name: 'Item', pricePaise: 1000, quantity: 1 }];
    expect(calcSubtotal(items)).toBeGreaterThan(0);
  });
});
