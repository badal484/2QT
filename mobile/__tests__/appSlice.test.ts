import appReducer, {
  setGlobalLocation,
  setServiceabilityChecking,
  setServiceable,
  setUnserviceable,
  setNoLocation,
  setNetworkError,
  setFeatures,
} from '../src/store/slices/appSlice';

const empty = {
  globalLocation: null,
  serviceabilityStatus: 'idle' as const,
  activeZoneId: null,
  activeZoneName: null,
  featureLoyalty: true,
  featureReferrals: true,
};

const LOC = { latitude: 12.9716, longitude: 77.5946, addressText: 'Bengaluru' };

describe('appSlice — setGlobalLocation', () => {
  it('stores location object', () => {
    const state = appReducer(empty, setGlobalLocation(LOC));
    expect(state.globalLocation).toEqual(LOC);
  });

  it('clears location when null is passed', () => {
    const s1 = appReducer(empty, setGlobalLocation(LOC));
    const s2 = appReducer(s1, setGlobalLocation(null));
    expect(s2.globalLocation).toBeNull();
  });
});

describe('appSlice — setServiceabilityChecking', () => {
  it('sets status to checking', () => {
    const state = appReducer(empty, setServiceabilityChecking());
    expect(state.serviceabilityStatus).toBe('checking');
  });

  it('does NOT clear activeZoneId (avoids menu flash)', () => {
    const s1 = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    const s2 = appReducer(s1, setServiceabilityChecking());
    expect(s2.activeZoneId).toBe('z-1'); // preserved
  });
});

describe('appSlice — setServiceable', () => {
  it('sets status to serviceable with zoneId and zoneName', () => {
    const state = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    expect(state.serviceabilityStatus).toBe('serviceable');
    expect(state.activeZoneId).toBe('z-1');
    expect(state.activeZoneName).toBe('Zone A');
  });

  it('also updates globalLocation when provided', () => {
    const state = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A', location: LOC }));
    expect(state.globalLocation).toEqual(LOC);
  });

  it('does NOT update location when not provided', () => {
    const s1 = appReducer(empty, setGlobalLocation(LOC));
    const s2 = appReducer(s1, setServiceable({ zoneId: 'z-1', zoneName: null }));
    expect(s2.globalLocation).toEqual(LOC); // preserved
  });

  it('handles null zoneName', () => {
    const state = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: null }));
    expect(state.activeZoneName).toBeNull();
  });
});

describe('appSlice — setUnserviceable', () => {
  it('sets status to unserviceable and clears zoneId', () => {
    const s1 = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    const s2 = appReducer(s1, setUnserviceable());
    expect(s2.serviceabilityStatus).toBe('unserviceable');
    expect(s2.activeZoneId).toBeNull();
    expect(s2.activeZoneName).toBeNull();
  });

  it('updates location when provided', () => {
    const state = appReducer(empty, setUnserviceable(LOC));
    expect(state.globalLocation).toEqual(LOC);
  });

  it('does not update location when not provided', () => {
    const s1 = appReducer(empty, setGlobalLocation(LOC));
    const s2 = appReducer(s1, setUnserviceable());
    expect(s2.globalLocation).toEqual(LOC);
  });
});

describe('appSlice — setNoLocation', () => {
  it('sets status to no_location and clears zone', () => {
    const s1 = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    const s2 = appReducer(s1, setNoLocation());
    expect(s2.serviceabilityStatus).toBe('no_location');
    expect(s2.activeZoneId).toBeNull();
    expect(s2.activeZoneName).toBeNull();
  });
});

describe('appSlice — setNetworkError', () => {
  it('sets status to network_error', () => {
    const state = appReducer(empty, setNetworkError());
    expect(state.serviceabilityStatus).toBe('network_error');
  });

  it('KEEPS activeZoneId on network error (cached zone preserved)', () => {
    const s1 = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    const s2 = appReducer(s1, setNetworkError());
    expect(s2.activeZoneId).toBe('z-1');
  });
});

describe('appSlice — setFeatures', () => {
  it('updates loyalty and referrals flags', () => {
    const state = appReducer(empty, setFeatures({ loyalty: false, referrals: false }));
    expect(state.featureLoyalty).toBe(false);
    expect(state.featureReferrals).toBe(false);
  });

  it('can re-enable features', () => {
    const s1 = appReducer(empty, setFeatures({ loyalty: false, referrals: false }));
    const s2 = appReducer(s1, setFeatures({ loyalty: true, referrals: true }));
    expect(s2.featureLoyalty).toBe(true);
    expect(s2.featureReferrals).toBe(true);
  });

  it('defaults are both true', () => {
    expect(empty.featureLoyalty).toBe(true);
    expect(empty.featureReferrals).toBe(true);
  });
});

describe('appSlice — serviceability state machine transitions', () => {
  it('follows the idle → checking → serviceable path', () => {
    let state = appReducer(empty, setServiceabilityChecking());
    expect(state.serviceabilityStatus).toBe('checking');
    state = appReducer(state, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    expect(state.serviceabilityStatus).toBe('serviceable');
  });

  it('follows the idle → checking → unserviceable path', () => {
    let state = appReducer(empty, setServiceabilityChecking());
    state = appReducer(state, setUnserviceable());
    expect(state.serviceabilityStatus).toBe('unserviceable');
  });

  it('follows the idle → checking → no_location path', () => {
    let state = appReducer(empty, setServiceabilityChecking());
    state = appReducer(state, setNoLocation());
    expect(state.serviceabilityStatus).toBe('no_location');
  });

  it('follows the serviceable → checking → network_error path with zone preserved', () => {
    let state = appReducer(empty, setServiceable({ zoneId: 'z-1', zoneName: 'Zone A' }));
    state = appReducer(state, setServiceabilityChecking());
    state = appReducer(state, setNetworkError());
    expect(state.serviceabilityStatus).toBe('network_error');
    expect(state.activeZoneId).toBe('z-1');
  });
});
