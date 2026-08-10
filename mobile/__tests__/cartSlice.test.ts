import cartReducer, {
  addItem,
  removeItem,
  setQuantity,
  clearCart,
  setZone,
  setAddress,
  setPromoCode,
  toggleWallet,
  toggleLoyalty,
  setInstructions,
  setScheduledAt,
} from '../src/store/slices/cartSlice';

// Silence redux-toolkit thunk warning in tests
jest.mock('../src/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

function makeItem(overrides = {}) {
  return {
    cartItemId: 'ci-1',
    menuItemId: 'mi-1',
    name: 'Biryani',
    pricePaise: 15000,
    quantity: 1,
    photoUrl: null,
    isVeg: false,
    kitchenId: 'k-1',
    ...overrides,
  };
}

const empty = {
  items: [],
  zoneId: null,
  addressId: null,
  promoCode: null,
  useWallet: false,
  useLoyalty: false,
  instructions: '',
  scheduledAt: null,
  isValidating: false,
};

describe('cartSlice — addItem', () => {
  it('adds item to empty cart', () => {
    const item = makeItem();
    const state = cartReducer(empty, addItem(item));
    expect(state.items).toHaveLength(1);
    expect(state.items[0].name).toBe('Biryani');
  });

  it('increments quantity when same item + same customizations added again', () => {
    const item = makeItem({ customizations: [] });
    const state1 = cartReducer(empty, addItem(item));
    const state2 = cartReducer(state1, addItem({ ...item, quantity: 2 }));
    expect(state2.items).toHaveLength(1);
    expect(state2.items[0].quantity).toBe(3);
  });

  it('adds as separate line when customizations differ', () => {
    const base = makeItem({ menuItemId: 'mi-1', customizations: [] });
    const variant = makeItem({ menuItemId: 'mi-1', cartItemId: 'ci-2', customizations: [{ group: 'Spice', option: 'Hot' }] });
    const state1 = cartReducer(empty, addItem(base));
    const state2 = cartReducer(state1, addItem(variant));
    expect(state2.items).toHaveLength(2);
  });

  it('clears cart and starts fresh when item from a different kitchen is added', () => {
    const item1 = makeItem({ kitchenId: 'k-1' });
    const item2 = makeItem({ cartItemId: 'ci-2', menuItemId: 'mi-2', name: 'Roti', kitchenId: 'k-2' });
    const state1 = cartReducer(empty, addItem(item1));
    const state2 = cartReducer(state1, addItem(item2));
    expect(state2.items).toHaveLength(1);
    expect(state2.items[0].name).toBe('Roti');
  });

  it('generates a cartItemId if none is provided', () => {
    const item = makeItem({ cartItemId: undefined });
    const state = cartReducer(empty, addItem(item));
    expect(state.items[0].cartItemId).toBeDefined();
    expect(typeof state.items[0].cartItemId).toBe('string');
  });
});

describe('cartSlice — removeItem', () => {
  it('removes item by cartItemId', () => {
    const item = makeItem({ cartItemId: 'ci-1' });
    const withItem = cartReducer(empty, addItem(item));
    const state = cartReducer(withItem, removeItem('ci-1'));
    expect(state.items).toHaveLength(0);
  });

  it('leaves other items untouched', () => {
    const s1 = cartReducer(empty, addItem(makeItem({ cartItemId: 'ci-1', menuItemId: 'mi-1' })));
    const s2 = cartReducer(s1, addItem(makeItem({ cartItemId: 'ci-2', menuItemId: 'mi-2', name: 'Roti' })));
    const s3 = cartReducer(s2, removeItem('ci-1'));
    expect(s3.items).toHaveLength(1);
    expect(s3.items[0].name).toBe('Roti');
  });
});

describe('cartSlice — setQuantity', () => {
  it('sets quantity by cartItemId', () => {
    const s1 = cartReducer(empty, addItem(makeItem({ cartItemId: 'ci-1' })));
    const s2 = cartReducer(s1, setQuantity({ cartItemId: 'ci-1', quantity: 5 }));
    expect(s2.items[0].quantity).toBe(5);
  });

  it('removes item when quantity is set to 0', () => {
    const s1 = cartReducer(empty, addItem(makeItem({ cartItemId: 'ci-1' })));
    const s2 = cartReducer(s1, setQuantity({ cartItemId: 'ci-1', quantity: 0 }));
    expect(s2.items).toHaveLength(0);
  });

  it('removes item when quantity is set to negative', () => {
    const s1 = cartReducer(empty, addItem(makeItem({ cartItemId: 'ci-1' })));
    const s2 = cartReducer(s1, setQuantity({ cartItemId: 'ci-1', quantity: -1 }));
    expect(s2.items).toHaveLength(0);
  });

  it('does nothing when cartItemId is not found', () => {
    const s1 = cartReducer(empty, addItem(makeItem({ cartItemId: 'ci-1' })));
    const s2 = cartReducer(s1, setQuantity({ cartItemId: 'ghost', quantity: 5 }));
    expect(s2.items[0].quantity).toBe(1);
  });
});

describe('cartSlice — clearCart', () => {
  it('empties items, resets promoCode, useWallet, and useLoyalty', () => {
    const s1 = cartReducer(empty, addItem(makeItem()));
    const s2 = cartReducer(s1, setPromoCode('SAVE10'));
    const s3 = cartReducer(s2, toggleWallet());
    const s4 = cartReducer(s3, toggleLoyalty());
    const result = cartReducer(s4, clearCart());
    expect(result.items).toHaveLength(0);
    expect(result.promoCode).toBeNull();
    expect(result.useWallet).toBe(false);
    expect(result.useLoyalty).toBe(false);
  });

  it('does not crash on already-empty cart', () => {
    const state = cartReducer(empty, clearCart());
    expect(state.items).toHaveLength(0);
  });
});

describe('cartSlice — setZone', () => {
  it('sets zone when cart is empty', () => {
    const state = cartReducer(empty, setZone('zone-1'));
    expect(state.zoneId).toBe('zone-1');
  });

  it('clears items when zone changes', () => {
    const s1 = cartReducer(empty, setZone('zone-1'));
    const s2 = cartReducer(s1, addItem(makeItem()));
    const s3 = cartReducer(s2, setPromoCode('CODE'));
    const s4 = cartReducer(s3, setZone('zone-2')); // zone change
    expect(s4.items).toHaveLength(0);
    expect(s4.promoCode).toBeNull();
    expect(s4.zoneId).toBe('zone-2');
  });

  it('does not clear items when same zone is set again', () => {
    const s1 = cartReducer(empty, setZone('zone-1'));
    const s2 = cartReducer(s1, addItem(makeItem()));
    const s3 = cartReducer(s2, setZone('zone-1')); // same zone
    expect(s3.items).toHaveLength(1);
  });

  it('accepts null to clear zone', () => {
    const s1 = cartReducer(empty, setZone('zone-1'));
    const s2 = cartReducer(s1, setZone(null));
    expect(s2.zoneId).toBeNull();
  });
});

describe('cartSlice — setAddress', () => {
  it('sets address ID', () => {
    const state = cartReducer(empty, setAddress('addr-1'));
    expect(state.addressId).toBe('addr-1');
  });

  it('clears address to null', () => {
    const s1 = cartReducer(empty, setAddress('addr-1'));
    const s2 = cartReducer(s1, setAddress(null));
    expect(s2.addressId).toBeNull();
  });
});

describe('cartSlice — toggleWallet / toggleLoyalty', () => {
  it('toggles wallet from false to true', () => {
    const state = cartReducer(empty, toggleWallet());
    expect(state.useWallet).toBe(true);
  });

  it('toggles wallet back to false', () => {
    const s1 = cartReducer(empty, toggleWallet());
    const s2 = cartReducer(s1, toggleWallet());
    expect(s2.useWallet).toBe(false);
  });

  it('toggles loyalty independently of wallet', () => {
    const s1 = cartReducer(empty, toggleWallet());
    const s2 = cartReducer(s1, toggleLoyalty());
    expect(s2.useWallet).toBe(true);
    expect(s2.useLoyalty).toBe(true);
  });
});

describe('cartSlice — setPromoCode', () => {
  it('sets a promo code string', () => {
    const state = cartReducer(empty, setPromoCode('FLAT50'));
    expect(state.promoCode).toBe('FLAT50');
  });

  it('clears promo code to null', () => {
    const s1 = cartReducer(empty, setPromoCode('FLAT50'));
    const s2 = cartReducer(s1, setPromoCode(null));
    expect(s2.promoCode).toBeNull();
  });
});

describe('cartSlice — setInstructions / setScheduledAt', () => {
  it('stores delivery instructions', () => {
    const state = cartReducer(empty, setInstructions('No onion please'));
    expect(state.instructions).toBe('No onion please');
  });

  it('stores scheduledAt ISO string', () => {
    const iso = '2026-08-10T12:00:00.000Z';
    const state = cartReducer(empty, setScheduledAt(iso));
    expect(state.scheduledAt).toBe(iso);
  });

  it('clears scheduledAt to null', () => {
    const s1 = cartReducer(empty, setScheduledAt('2026-08-10T12:00:00.000Z'));
    const s2 = cartReducer(s1, setScheduledAt(null));
    expect(s2.scheduledAt).toBeNull();
  });
});
