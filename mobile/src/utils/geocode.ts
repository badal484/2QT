import { ENV } from '../config/env';

// Routes through our backend which tries Google Geocoding then falls back to Nominatim.
// More reliable than calling Nominatim directly from the device (no rate limits, stable server).
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `${ENV.API_URL}/menu/geocode/reverse?lat=${lat}&lng=${lng}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data?.display_name) return data.display_name;
  } catch {}
  return 'Current Location';
}
