import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { createMMKV } from 'react-native-mmkv';
import type { MMKV } from 'react-native-mmkv';
import { api } from '../../api/client';

let storageInstance: MMKV | null = null;
const getStorage = () => {
  if (!storageInstance) {
    storageInstance = createMMKV();
  }
  return storageInstance;
};

// ... CartItem and CartState interfaces ...
interface CartItem {
  menuItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
  photoUrl: string | null;
  isVeg: boolean;
  kitchenId: string;
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

// ... Storage helper functions ...
const getStoredString = (key: string) => getStorage().getString(key);
const getStoredBool = (key: string) => getStorage().getBoolean(key);
const getItemsFromStorage = () => {
    try {
      const val = getStorage().getString('cart.items');
      return val ? JSON.parse(val) : [];
    } catch (e) {
      return [];
    }
};

const initialState: CartState = {
  items: getItemsFromStorage(),
  zoneId: getStoredString('cart.zoneId') || null,
  addressId: getStoredString('cart.addressId') || null,
  promoCode: getStoredString('cart.promoCode') || null,
  useWallet: getStoredBool('cart.useWallet') || false,
  useLoyalty: getStoredBool('cart.useLoyalty') || false,
  instructions: getStoredString('cart.instructions') || '',
  scheduledAt: getStoredString('cart.scheduledAt') || null,
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
        if (state.items.length > 0 && state.items[0].kitchenId !== action.payload.kitchenId) {
          state.items = [action.payload];
        } else {
          const existing = state.items.find(i => i.menuItemId === action.payload.menuItemId);
          if (existing) {
            existing.quantity += action.payload.quantity;
          } else {
            state.items.push(action.payload);
          }
        }
        getStorage().set('cart.items', JSON.stringify(state.items));
      },
      removeItem: (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(i => i.menuItemId !== action.payload);
        getStorage().set('cart.items', JSON.stringify(state.items));
      },
      setQuantity: (state, action: PayloadAction<{ menuItemId: string; quantity: number }>) => {
        const item = state.items.find(i => i.menuItemId === action.payload.menuItemId);
        if (item) {
          item.quantity = action.payload.quantity;
          if (item.quantity <= 0) {
            state.items = state.items.filter(i => i.menuItemId !== action.payload.menuItemId);
          }
        }
        getStorage().set('cart.items', JSON.stringify(state.items));
      },
      clearCart: (state) => {
        state.items = [];
        state.promoCode = null;
        state.useWallet = false;
        state.useLoyalty = false;
        getStorage().remove('cart.items');
        getStorage().remove('cart.promoCode');
        getStorage().remove('cart.useWallet');
        getStorage().remove('cart.useLoyalty');
      },
      setZone: (state, action: PayloadAction<string | null>) => {
        if (state.zoneId && action.payload && state.zoneId !== action.payload) {
          // Zone changed, clear cart!
          state.items = [];
          state.promoCode = null;
          getStorage().remove('cart.items');
          getStorage().remove('cart.promoCode');
        }
        state.zoneId = action.payload;
        if (action.payload) getStorage().set('cart.zoneId', action.payload);
        else getStorage().remove('cart.zoneId');
      },
      setAddress: (state, action: PayloadAction<string | null>) => {
        state.addressId = action.payload;
        if (action.payload) getStorage().set('cart.addressId', action.payload);
        else getStorage().remove('cart.addressId');
      },
      setPromoCode: (state, action: PayloadAction<string | null>) => {
        state.promoCode = action.payload;
        if (action.payload) getStorage().set('cart.promoCode', action.payload);
        else getStorage().remove('cart.promoCode');
      },
      toggleWallet: (state) => {
        state.useWallet = !state.useWallet;
        getStorage().set('cart.useWallet', state.useWallet);
      },
      toggleLoyalty: (state) => {
        state.useLoyalty = !state.useLoyalty;
        getStorage().set('cart.useLoyalty', state.useLoyalty);
      },
      setInstructions: (state, action: PayloadAction<string>) => {
        state.instructions = action.payload;
        getStorage().set('cart.instructions', action.payload);
      },
      setScheduledAt: (state, action: PayloadAction<string | null>) => {
        state.scheduledAt = action.payload;
        if (action.payload) getStorage().set('cart.scheduledAt', action.payload);
        else getStorage().remove('cart.scheduledAt');
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
        getStorage().set('cart.items', JSON.stringify(state.items));
      })
      .addCase(fetchCloudCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        // SYSTEMATIC INTEGRATION: Omnichannel Sync
        // If we have items locally, we keep them. If local is empty, we use cloud.
        if (state.items.length === 0 && action.payload && action.payload.length > 0) {
          state.items = action.payload;
          getStorage().set('cart.items', JSON.stringify(state.items));
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
