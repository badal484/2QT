// Tests for ApiClient in app/lib/api.ts
// We test the real class — fetch is replaced with jest.fn() per test.

// Reset module between describe blocks so isRefreshing / refreshQueue don't leak
let api: any;

function mockFetchOnce(status: number, body: any, ok?: boolean) {
  const isOk = ok !== undefined ? ok : status >= 200 && status < 300;
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: isOk,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
}

function mockFetchNetworkError(msg = 'Failed to fetch') {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(msg));
}

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn();
  localStorage.clear();
  // re-import fresh instance each test so module-level state resets
  const mod = require('../app/lib/api');
  api = mod.api;
});

describe('ApiClient — successful requests', () => {
  it('returns parsed JSON on 200 GET', async () => {
    mockFetchOnce(200, { items: ['a', 'b'] });
    const data = await api.get('/menu');
    expect(data).toEqual({ items: ['a', 'b'] });
  });

  it('sends Authorization header when token is in localStorage', async () => {
    localStorage.setItem('2qt_token', 'my-jwt');
    mockFetchOnce(200, { ok: true });
    await api.get('/some-endpoint');
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(opts.headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  it('does not send Authorization header when no token', async () => {
    mockFetchOnce(200, { ok: true });
    await api.get('/public');
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(opts.headers.get('Authorization')).toBeNull();
  });

  it('sends X-Pinggy-No-Screen header on every request', async () => {
    mockFetchOnce(200, {});
    await api.get('/any');
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(opts.headers.get('X-Pinggy-No-Screen')).toBe('true');
  });

  it('handles empty response body without throwing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => '',
      json: async () => ({}),
    });
    const data = await api.get('/empty');
    expect(data).toEqual({});
  });

  it('returns parsed JSON on POST with body', async () => {
    mockFetchOnce(200, { created: true });
    const data = await api.post('/orders', { item: 'Biryani' });
    expect(data).toEqual({ created: true });
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ item: 'Biryani' }));
  });
});

describe('ApiClient — error handling', () => {
  it('throws error with message from response body on non-2xx', async () => {
    mockFetchOnce(400, { message: 'Invalid phone number' }, false);
    await expect(api.get('/auth/send-otp')).rejects.toThrow('Invalid phone number');
  });

  it('throws error with details field when present', async () => {
    mockFetchOnce(422, { details: 'Promo code expired' }, false);
    await expect(api.post('/checkout')).rejects.toThrow('Promo code expired');
  });

  it('throws generic message when error body has no message', async () => {
    mockFetchOnce(500, {}, false);
    await expect(api.get('/crash')).rejects.toThrow('Something went wrong');
  });

  it('throws SERVER_TIMEOUT on AbortError', async () => {
    const err: any = new Error('aborted');
    err.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValueOnce(err);
    await expect(api.get('/slow')).rejects.toThrow('SERVER_TIMEOUT');
  });

  it('throws Network error on generic fetch failure', async () => {
    mockFetchNetworkError();
    await expect(api.get('/broken')).rejects.toThrow(/Network error/);
  });
});

describe('ApiClient — 401 auto-refresh flow', () => {
  it('retries request after refreshing access token on 401', async () => {
    localStorage.setItem('2qt_token', 'expired-token');
    localStorage.setItem('2qt_refresh_token', 'valid-refresh');

    // First call → 401 (expired)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{}', json: async () => ({}) })
      // refresh call → 200 with new token
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ accessToken: 'new-token' }), json: async () => ({ accessToken: 'new-token' }) })
      // retry with new token → 200
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ data: 'ok' }), json: async () => ({ data: 'ok' }) });

    const result = await api.get('/profile');
    expect(result).toEqual({ data: 'ok' });
    expect(localStorage.getItem('2qt_token')).toBe('new-token');
  });

  it('throws session expired when refresh returns 401', async () => {
    localStorage.setItem('2qt_token', 'expired');
    localStorage.setItem('2qt_refresh_token', 'also-expired');

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{}', json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{}', json: async () => ({}) });

    await expect(api.get('/profile')).rejects.toThrow(/Session expired/);
    expect(localStorage.getItem('2qt_token')).toBeNull();
    expect(localStorage.getItem('2qt_refresh_token')).toBeNull();
  });

  it('throws connection error when refresh network fails', async () => {
    localStorage.setItem('2qt_token', 'expired');
    localStorage.setItem('2qt_refresh_token', 'valid-refresh');

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{}', json: async () => ({}) })
      .mockRejectedValueOnce(new Error('network gone')); // refresh call fails

    await expect(api.get('/profile')).rejects.toThrow(/Connection error/);
    // Token NOT cleared — transient error
    expect(localStorage.getItem('2qt_refresh_token')).toBe('valid-refresh');
  });

  it('returns null from refreshAccessToken when no refresh token in localStorage', async () => {
    localStorage.setItem('2qt_token', 'expired');
    // No refresh token

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{}', json: async () => ({}) });
    // refresh call should NOT fire — no refresh token

    await expect(api.get('/profile')).rejects.toThrow(/Session expired/);
  });
});

describe('ApiClient — verifyOtp', () => {
  it('stores tokens in localStorage on successful OTP verify', async () => {
    mockFetchOnce(200, {
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      user: { id: 'u1', phone: '919999999999' },
    });
    await api.verifyOtp('919999999999', '123456');
    expect(localStorage.getItem('2qt_token')).toBe('access-abc');
    expect(localStorage.getItem('2qt_refresh_token')).toBe('refresh-xyz');
    const user = JSON.parse(localStorage.getItem('2qt_user')!);
    expect(user.phone).toBe('919999999999');
  });

  it('sends referralCode and appRole in body when provided', async () => {
    mockFetchOnce(200, { accessToken: 't', refreshToken: 'r', user: {} });
    await api.verifyOtp('919999999999', '654321', 'REF10', 'Arjun', 'customer');
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.referralCode).toBe('REF10');
    expect(body.appRole).toBe('customer');
  });
});

describe('ApiClient — logout', () => {
  it('clears all auth keys from localStorage', async () => {
    localStorage.setItem('2qt_token', 'tok');
    localStorage.setItem('2qt_refresh_token', 'ref');
    localStorage.setItem('2qt_user', '{"id":"u1"}');
    await api.logout();
    expect(localStorage.getItem('2qt_token')).toBeNull();
    expect(localStorage.getItem('2qt_refresh_token')).toBeNull();
    expect(localStorage.getItem('2qt_user')).toBeNull();
  });
});

describe('ApiClient — getApiUrl (SSR vs browser)', () => {
  it('uses /api/proxy in browser environment (window defined)', () => {
    // window is defined in jsdom — so the module uses /api/proxy
    jest.resetModules();
    const { api: freshApi } = require('../app/lib/api');
    // We can verify indirectly: the fetch URL should start with /api/proxy
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, text: async () => '{}', json: async () => ({}),
    });
    freshApi.get('/test');
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/^\/api\/proxy/);
  });
});
