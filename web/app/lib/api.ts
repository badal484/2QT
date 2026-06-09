const getApiUrl = () => {
  return 'https://yicfp-117-96-21-221.run.pinggy-free.link/api/v1';
};

const API_BASE_URL = getApiUrl();
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('2qt_refresh_token') : null;
  if (!refreshToken) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      localStorage.removeItem('2qt_token');
      localStorage.removeItem('2qt_refresh_token');
      localStorage.removeItem('2qt_user');
      return null;
    }

    const data = await res.json();
    localStorage.setItem('2qt_token', data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

class ApiClient {
  public async request(endpoint: string, options: RequestInit = {}, retry = true): Promise<any> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('2qt_token') : null;

    const headers = new Headers({
      ...((!options.body || typeof options.body === 'string') && { 'Content-Type': 'application/json' }),
      'X-Pinggy-No-Screen': 'true',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    });

    let response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
    } catch (e: any) {
      if (e.name === 'AbortError') {
         throw new Error(`Request timed out. Server is unreachable.`);
      }
      throw new Error(`Network error on ${endpoint}. Make sure the backend server is running.`);
    }

    // Auto-refresh on 401
    if (response.status === 401 && retry) {
      if (isRefreshing) {
        // Wait for the ongoing refresh to complete
        await new Promise<string>((resolve) => {
          refreshQueue.push(resolve);
        });
        return this.request(endpoint, options, false);
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        return this.request(endpoint, options, false);
      } else {
        // Clear queue and reject waiting requests
        refreshQueue.forEach((cb) => cb(''));
        refreshQueue = [];
      }
      
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }

    // Handle empty responses
    const text = await response.text();
    let data: any = {};
    try {
      if (text) data = JSON.parse(text);
    } catch {
      data = { error: 'Server returned non-JSON response (possibly offline)' };
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Something went wrong');
    }

    return data;
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, body?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch(endpoint: string, body?: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put(endpoint: string, body?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth
  async sendOtp(phone: string) {
    return await this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(phone: string, otp: string, name?: string, appRole?: string) {
    const data = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, name, appRole }),
    });
    if (data?.accessToken) {
      localStorage.setItem('2qt_token', data.accessToken);
      localStorage.setItem('2qt_refresh_token', data.refreshToken);
      localStorage.setItem('2qt_user', JSON.stringify(data.user));
    }
    return data;
  }

  async logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('2qt_token');
      localStorage.removeItem('2qt_refresh_token');
      localStorage.removeItem('2qt_user');
    }
  }

  // Menu
  async getMenu(zoneId: string) {
    return this.request(`/menu?zoneId=${encodeURIComponent(zoneId)}`);
  }

  // Profile
  async getProfile() {
    return this.request('/customers/me');
  }

  async updateProfile(data: { name?: string, email?: string, photo_url?: string }) {
    const res = await this.request('/customers/profile', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    if (res.user && typeof window !== 'undefined') {
      localStorage.setItem('2qt_user', JSON.stringify(res.user));
    }
    return res.user;
  }

  // File Upload
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('2qt_token') : null;
    const res = await fetch(`${API_BASE_URL}/upload/image`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    
    let data;
    try {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
      }
    } catch (e: any) {
      throw new Error(`Upload fetch error: ${e.message}`);
    }

    if (!res.ok) throw new Error(data.message || data.error || 'Failed to upload image');
    return data;
  }

  // Rider Onboarding
  async applyToRide(vehicleType: string, licenseNumber: string, idPhotoUrl?: string) {
    return this.request('/riders/apply', {
      method: 'POST',
      body: JSON.stringify({ vehicleType, licenseNumber, idPhotoUrl }),
    });
  }

  async getApplicationStatus() {
    return this.request('/riders/application-status');
  }

  // Admin: Rider Applications
  async getAdminRiderApplications() {
    return this.request('/admin/rider-applications');
  }

  async actionAdminRiderApplication(id: string, action: 'approve' | 'reject') {
    return this.request(`/admin/rider-applications/${id}/${action}`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
