import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createMMKV } from 'react-native-mmkv';
import type { MMKV } from 'react-native-mmkv';

let storageInstance: MMKV | null = null;
const getStorage = () => {
  if (!storageInstance) {
    storageInstance = createMMKV();
  }
  return storageInstance;
};

interface AuthState {
  user: null | {
    id: string;
    name: string;
    email?: string | null;
    phone: string;
    photo_url?: string | null;
    role: string;
    termsAcceptedAt: string | null;
    kitchenId: string | null;
    zoneId: string | null;
    onboarding_complete: boolean;
    is_online?: boolean;
    online_since?: string | null;
    is_verified?: boolean;
  };
  accessToken: null | string;
  refreshToken: null | string;
}

const getUserFromStorage = () => {
  try {
    const val = getStorage().getString('auth.user');
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return null;
  }
};

const initialState: AuthState = {
  user: getUserFromStorage(),
  accessToken: getStorage().getString('auth.accessToken') || null,
  refreshToken: getStorage().getString('auth.refreshToken') || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: any; accessToken: string | null; refreshToken: string | null }>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      getStorage().set('auth.user', JSON.stringify(action.payload.user));
      if (action.payload.accessToken) getStorage().set('auth.accessToken', action.payload.accessToken);
      else getStorage().remove('auth.accessToken');
      
      if (action.payload.refreshToken) getStorage().set('auth.refreshToken', action.payload.refreshToken);
      else getStorage().remove('auth.refreshToken');
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
      if (action.payload) getStorage().set('auth.accessToken', action.payload);
      else getStorage().remove('auth.accessToken');
    },
    updateUser: (state, action: PayloadAction<Partial<AuthState['user']>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        getStorage().set('auth.user', JSON.stringify(state.user));
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      const s = getStorage();
      s.remove('auth.user');
      s.remove('auth.accessToken');
      s.remove('auth.refreshToken');
    },
    completeOnboarding: (state) => {
      if (state.user) {
        state.user.onboarding_complete = true;
        getStorage().set('auth.user', JSON.stringify(state.user));
      }
    },
  },
});

export const { setAuth, setAccessToken, updateUser, logout, completeOnboarding } = authSlice.actions;
export default authSlice.reducer;
