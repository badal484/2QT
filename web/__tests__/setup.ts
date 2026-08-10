// Stub localStorage for jsdom
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(k: string) { return this.store[k] ?? null; }
  setItem(k: string, v: string) { this.store[k] = v; }
  removeItem(k: string) { delete this.store[k]; }
  clear() { this.store = {}; }
}

Object.defineProperty(global, 'localStorage', { value: new LocalStorageMock(), writable: true });

// Minimal fetch stub — individual tests override via jest.spyOn or jest.fn()
if (!global.fetch) {
  global.fetch = jest.fn();
}
