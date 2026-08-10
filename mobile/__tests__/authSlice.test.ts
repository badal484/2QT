import authReducer, {
  setAuth,
  setAccessToken,
  updateUser,
  logout,
  completeOnboarding,
} from '../src/store/slices/authSlice';

const MOCK_USER = {
  id: 'u-1',
  name: 'Arjun Kumar',
  phone: '919876543210',
  role: 'customer',
  termsAcceptedAt: null,
  kitchenId: null,
  zoneId: 'zone-1',
  onboarding_complete: false,
};

const empty = { user: null, accessToken: null, refreshToken: null };

describe('authSlice — setAuth', () => {
  it('sets user, accessToken and refreshToken', () => {
    const state = authReducer(empty, setAuth({
      user: MOCK_USER,
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
    }));
    expect(state.user).toEqual(MOCK_USER);
    expect(state.accessToken).toBe('access-abc');
    expect(state.refreshToken).toBe('refresh-xyz');
  });

  it('replaces a previous user', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    const newUser = { ...MOCK_USER, id: 'u-2', name: 'Priya' };
    const s2 = authReducer(s1, setAuth({ user: newUser, accessToken: 'a2', refreshToken: 'r2' }));
    expect(s2.user?.name).toBe('Priya');
    expect(s2.accessToken).toBe('a2');
  });

  it('allows setting user to null (logged-out state)', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    const s2 = authReducer(s1, setAuth({ user: null, accessToken: null, refreshToken: null }));
    expect(s2.user).toBeNull();
  });
});

describe('authSlice — setAccessToken', () => {
  it('updates only the access token', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'old', refreshToken: 'ref' }));
    const s2 = authReducer(s1, setAccessToken('new-token'));
    expect(s2.accessToken).toBe('new-token');
    expect(s2.refreshToken).toBe('ref'); // unchanged
    expect(s2.user?.id).toBe('u-1'); // user unchanged
  });

  it('can clear accessToken to null', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'tok', refreshToken: 'ref' }));
    const s2 = authReducer(s1, setAccessToken(null));
    expect(s2.accessToken).toBeNull();
  });

  it('does not throw when state has no user yet', () => {
    const state = authReducer(empty, setAccessToken('tok'));
    expect(state.accessToken).toBe('tok');
  });
});

describe('authSlice — updateUser', () => {
  it('merges partial user fields', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    const s2 = authReducer(s1, updateUser({ name: 'Rahul', zoneId: 'zone-2' }));
    expect(s2.user?.name).toBe('Rahul');
    expect(s2.user?.zoneId).toBe('zone-2');
    expect(s2.user?.id).toBe('u-1'); // other fields preserved
  });

  it('does nothing when user is null', () => {
    const state = authReducer(empty, updateUser({ name: 'Ghost' }));
    expect(state.user).toBeNull();
  });

  it('can set email field', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    const s2 = authReducer(s1, updateUser({ email: 'arjun@example.com' }));
    expect(s2.user?.email).toBe('arjun@example.com');
  });

  it('can update is_online flag for riders', () => {
    const riderUser = { ...MOCK_USER, role: 'rider', is_online: false };
    const s1 = authReducer(empty, setAuth({ user: riderUser, accessToken: 'a', refreshToken: 'r' }));
    const s2 = authReducer(s1, updateUser({ is_online: true }));
    expect(s2.user?.is_online).toBe(true);
  });
});

describe('authSlice — logout', () => {
  it('clears all auth state', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    const s2 = authReducer(s1, logout());
    expect(s2.user).toBeNull();
    expect(s2.accessToken).toBeNull();
    expect(s2.refreshToken).toBeNull();
  });

  it('is safe to call on already-empty state', () => {
    const state = authReducer(empty, logout());
    expect(state).toEqual(empty);
  });
});

describe('authSlice — completeOnboarding', () => {
  it('sets onboarding_complete to true', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    expect(s1.user?.onboarding_complete).toBe(false);
    const s2 = authReducer(s1, completeOnboarding());
    expect(s2.user?.onboarding_complete).toBe(true);
  });

  it('does not crash when user is null', () => {
    const state = authReducer(empty, completeOnboarding());
    expect(state.user).toBeNull();
  });

  it('does not change other user fields', () => {
    const s1 = authReducer(empty, setAuth({ user: MOCK_USER, accessToken: 'a', refreshToken: 'r' }));
    const s2 = authReducer(s1, completeOnboarding());
    expect(s2.user?.role).toBe('customer');
    expect(s2.user?.phone).toBe('919876543210');
  });
});
