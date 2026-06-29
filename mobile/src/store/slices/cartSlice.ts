import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../api/client';

// ... CartItem and CartState interfaces ...
interface CartItem {
  cartItemId?: string; // To uniquely identify identical items with different customizations
  menuItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
  photoUrl: string | null;
  isVeg: boolean;
  kitchenId: string;
  customizations?: { group: string; option: string; photo_url?: string }[];
  instructions?: string;
}

interface CartState {
  items: CartItem[];
  zoneId: null | string;
  addressId: null | string;
  promoCode: null | string;
  useWallet: boolean;
  useLoyalty: boolean;
  instructions: string;
  scheduledAt: null | string;
  isValidating: boolean;
}

export const validateCartItems = createAsyncThunk(
  'cart/validate',
  async (items: CartItem[]) => {
    const response = await api.post('/menu/validate-cart', { items });
    return response; // { validItems: [], removedCount: 0, priceChanges: [] }
  }
);

const initialState: CartState = {
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

export const syncCartWithCloud = createAsyncThunk(
  'cart/syncWithCloud',
  async (items: CartItem[]) => {
    const response = await api.post('/customers/cart/sync', { items });
    return response;
  }
);

export const fetchCloudCart = createAsyncThunk(
  'cart/fetchFromCloud',
  async () => {
    const response = await api.get('/customers/cart');
    return response.items; // Array of CartItem
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
      addItem: (state, action: PayloadAction<CartItem>) => {
        const newItem = action.payload;
        if (!newItem.cartItemId) {
            newItem.cartItemId = `${newItem.menuItemId}-${Date.now()}`;
        }
        
        if (state.items.length > 0 && state.items[0].kitchenId !== newItem.kitchenId) {
          state.items = [newItem];
        } else {
          // Find matching item by BOTH menuItemId and identical customizations/instructions
          const existing = state.items.find(i => 
            i.menuItemId === newItem.menuItemId && 
            JSON.stringify(i.customizations || []) === JSON.stringify(newItem.customizations || []) &&
            (i.instructions || '') === (newItem.instructions || '')
          );
          
          if (existing) {
            existing.quantity += newItem.quantity;
          } else {
            state.items.push(newItem);
          }
        }
      },
      removeItem: (state, action: PayloadAction<string>) => {
        // Now using cartItemId to remove
        state.items = state.items.filter(i => (i.cartItemId || i.menuItemId) !== action.payload);
      },
      setQuantity: (state, action: PayloadAction<{ cartItemId?: string; menuItemId?: string; quantity: number }>) => {
        const item = state.items.find(i => 
          (action.payload.cartItemId && (i.cartItemId || i.menuItemId) === action.payload.cartItemId) ||
          (!action.payload.cartItemId && action.payload.menuItemId && i.menuItemId === action.payload.menuItemId)
        );
        if (item) {
          item.quantity = action.payload.quantity;
          if (item.quantity <= 0) {
            state.items = state.items.filter(i => 
              !(action.payload.cartItemId && (i.cartItemId || i.menuItemId) === action.payload.cartItemId) &&
              !(!action.payload.cartItemId && action.payload.menuItemId && i.menuItemId === action.payload.menuItemId)
            );
          }
        }
      },
      clearCart: (state) => {
        state.items = [];
        state.promoCode = null;
        state.useWallet = false;
        state.useLoyalty = false;
      },
      setZone: (state, action: PayloadAction<string | null>) => {
        if (state.zoneId && action.payload && state.zoneId !== action.payload) {
          state.items = [];
          state.promoCode = null;
        }
        state.zoneId = action.payload;
      },
      setAddress: (state, action: PayloadAction<string | null>) => {
        state.addressId = action.payload;
      },
      setPromoCode: (state, action: PayloadAction<string | null>) => {
        state.promoCode = action.payload;
      },
      toggleWallet: (state) => {
        state.useWallet = !state.useWallet;
      },
      toggleLoyalty: (state) => {
        state.useLoyalty = !state.useLoyalty;
      },
      setInstructions: (state, action: PayloadAction<string>) => {
        state.instructions = action.payload;
      },
      setScheduledAt: (state, action: PayloadAction<string | null>) => {
        state.scheduledAt = action.payload;
      },
  },
  extraReducers: (builder) => {
    builder
      .addCase(validateCartItems.pending, (state) => {
        state.isValidating = true;
      })
      .addCase(validateCartItems.fulfilled, (state, action: PayloadAction<any>) => {
        state.isValidating = false;
        state.items = action.payload.validItems;
      })
      .addCase(fetchCloudCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        if (state.items.length === 0 && action.payload && action.payload.length > 0) {
          state.items = action.payload;
        }
      });
  }
});

export const { 
  addItem, removeItem, setQuantity, clearCart, 
  setZone, setAddress, setPromoCode, toggleWallet, toggleLoyalty,
  setInstructions, setScheduledAt
} = cartSlice.actions;

export default cartSlice.reducer;
