import ordersReducer, {
  setActiveOrder,
  clearActiveOrder,
} from '../src/store/slices/ordersSlice';

const empty = { activeOrderId: null, activeOrderStatus: null };

describe('ordersSlice — setActiveOrder', () => {
  it('sets id and status', () => {
    const state = ordersReducer(empty, setActiveOrder({ id: 'ord-1', status: 'confirmed' }));
    expect(state.activeOrderId).toBe('ord-1');
    expect(state.activeOrderStatus).toBe('confirmed');
  });

  it('overwrites a previous active order', () => {
    const s1 = ordersReducer(empty, setActiveOrder({ id: 'ord-1', status: 'confirmed' }));
    const s2 = ordersReducer(s1, setActiveOrder({ id: 'ord-2', status: 'preparing' }));
    expect(s2.activeOrderId).toBe('ord-2');
    expect(s2.activeOrderStatus).toBe('preparing');
  });

  it('handles all known order statuses', () => {
    const statuses = ['pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    for (const status of statuses) {
      const state = ordersReducer(empty, setActiveOrder({ id: 'ord-x', status }));
      expect(state.activeOrderStatus).toBe(status);
    }
  });
});

describe('ordersSlice — clearActiveOrder', () => {
  it('resets to null', () => {
    const s1 = ordersReducer(empty, setActiveOrder({ id: 'ord-1', status: 'confirmed' }));
    const s2 = ordersReducer(s1, clearActiveOrder());
    expect(s2.activeOrderId).toBeNull();
    expect(s2.activeOrderStatus).toBeNull();
  });

  it('is safe to call when already clear', () => {
    const state = ordersReducer(empty, clearActiveOrder());
    expect(state).toEqual(empty);
  });
});
