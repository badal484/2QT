import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
    kitchenName?: string | null;
    zoneId: string | null;
    onboarding_complete: boolean;
    is_online?: boolean;
    online_since?: string | null;
    is_verified?: boolean;
  };
  accessToken: null | string;
  refreshToken: null | string;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: any; accessToken: string | null; refreshToken: string | null }>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
    },
    updateUser: (state, action: PayloadAction<Partial<AuthState['user']>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
    },
    completeOnboarding: (state) => {
      if (state.user) {
        state.user.onboarding_complete = true;
      }
    },
  },
});

export const { setAuth, setAccessToken, updateUser, logout, completeOnboarding } = authSlice.actions;
export default authSlice.reducer;
