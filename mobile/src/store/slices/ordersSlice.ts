import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OrdersState {
  activeOrderId: null | string;
  activeOrderStatus: null | string;
}

const initialState: OrdersState = {
  activeOrderId: null,
  activeOrderStatus: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setActiveOrder: (state, action: PayloadAction<{ id: string; status: string }>) => {
      state.activeOrderId = action.payload.id;
      state.activeOrderStatus = action.payload.status;
    },
    clearActiveOrder: (state) => {
      state.activeOrderId = null;
      state.activeOrderStatus = null;
    },
  },
});

export const { setActiveOrder, clearActiveOrder } = ordersSlice.actions;
export default ordersSlice.reducer;
