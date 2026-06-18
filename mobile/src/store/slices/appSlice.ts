import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Single source of truth for where the user is and whether we deliver there.
// 'idle'        — app just started, boot check has not run yet (splash is shown)
// 'checking'    — zone check is in progress (boot or re-check)
// 'serviceable' — GPS / address confirmed inside a delivery zone
// 'unserviceable'— GPS / address confirmed outside all delivery zones
// 'no_location' — GPS denied or failed; user must pick address manually
// 'network_error'— zone check failed due to network; show retry
export type ServiceabilityStatus =
  | 'idle'
  | 'checking'
  | 'serviceable'
  | 'unserviceable'
  | 'no_location'
  | 'network_error';

interface AppState {
  // The location that was last used for serviceability check
  globalLocation: {
    latitude: number;
    longitude: number;
    addressText: string;
  } | null;
  serviceabilityStatus: ServiceabilityStatus;
  // Only set when serviceabilityStatus === 'serviceable'
  activeZoneId: string | null;
  activeZoneName: string | null;
}

const initialState: AppState = {
  globalLocation: null,
  serviceabilityStatus: 'idle',
  activeZoneId: null,
  activeZoneName: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setGlobalLocation: (
      state,
      action: PayloadAction<AppState['globalLocation']>,
    ) => {
      state.globalLocation = action.payload;
    },

    setServiceabilityChecking: (state) => {
      state.serviceabilityStatus = 'checking';
      // Don't clear activeZoneId here — avoids menu flash on re-check
    },

    setServiceable: (
      state,
      action: PayloadAction<{
        zoneId: string;
        zoneName: string | null;
        location?: AppState['globalLocation'];
      }>,
    ) => {
      state.serviceabilityStatus = 'serviceable';
      state.activeZoneId = action.payload.zoneId;
      state.activeZoneName = action.payload.zoneName;
      if (action.payload.location) {
        state.globalLocation = action.payload.location;
      }
    },

    setUnserviceable: (
      state,
      action: PayloadAction<AppState['globalLocation'] | undefined>,
    ) => {
      state.serviceabilityStatus = 'unserviceable';
      state.activeZoneId = null;
      state.activeZoneName = null;
      if (action.payload) {
        state.globalLocation = action.payload;
      }
    },

    setNoLocation: (state) => {
      state.serviceabilityStatus = 'no_location';
      state.activeZoneId = null;
      state.activeZoneName = null;
    },

    setNetworkError: (state) => {
      // Keep activeZoneId — a network blip shouldn't wipe a valid cached zone
      state.serviceabilityStatus = 'network_error';
    },
  },
});

export const {
  setGlobalLocation,
  setServiceabilityChecking,
  setServiceable,
  setUnserviceable,
  setNoLocation,
  setNetworkError,
} = appSlice.actions;

export default appSlice.reducer;
