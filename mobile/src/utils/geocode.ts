import { api } from '../api/client';
import { ENV } from '../config/env';

export interface GeocodeResult {
  name: string;    // short label — road name or locality (for HomeScreen header)
  address: string; // full formatted address (for map picker subtitle)
}

// ─── 1. Backend proxy (Nominatim zoom=18 from server) ────────────────────────

async function backendReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const data = await api.get(`/app/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (data?.name) return { name: data.name, address: data.address || data.name };
  } catch {}
  return null;
}

// ─── 2. Google Geocoding HTTP API (if key is valid + API enabled) ─────────────

async function googleReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (!ENV.GOOGLE_GEOCODING_KEY || ENV.GOOGLE_GEOCODING_KEY.includes('YOUR_')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${ENV.GOOGLE_GEOCODING_KEY}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    const components: any[] = data.results[0].address_components || [];
    const get = (...types: string[]) => {
      for (const type of types) {
        const c = components.find((c: any) => c.types.includes(type));
        if (c) return c.long_name as string;
      }
      return null;
    };

    const name = get(
      'route',
      'sublocality_level_2', 'sublocality_level_1',
      'neighborhood', 'sublocality',
      'locality', 'administrative_area_level_2',
    );
    const address = (data.results[0].formatted_address as string || '').trim();
    if (name) return { name, address: address || name };
  } catch {
    clearTimeout(timer);
  }
  return null;
}

// ─── 3. Direct Nominatim fallback ────────────────────────────────────────────

async function nominatimReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&namedetails=1&zoom=18`,
      { signal: controller.signal, headers: { 'User-Agent': '2QT-FoodDelivery/1.0', 'Accept-Language': 'en' } },
    );
    clearTimeout(timer);
    const data = await res.json();
    if (!data) return null;

    const a = data.address || {};
    const nd = data.namedetails || {};
    const name =
      nd['name:en'] || nd.name || data.name ||
      a.road || a.pedestrian ||
      a.suburb || a.neighbourhood || a.quarter || a.hamlet ||
      a.village || a.town || a.city_district || a.city ||
      a.county || a.state_district || a.state || null;

    const parts = [
      a.road || a.pedestrian,
      a.suburb || a.neighbourhood || a.hamlet || a.village || a.town,
      a.county || a.state_district,
      a.state,
    ].filter(Boolean).filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);

    const address = parts.length >= 2
      ? parts.join(', ')
      : (data.display_name || '').split(', ')
          .filter((p: string) => p !== 'India' && !/^\d{4,6}$/.test(p))
          .join(', ');

    const finalName = name || address.split(', ')[0];
    if (finalName) return { name: finalName, address: address || finalName };
  } catch {
    clearTimeout(timer);
  }
  return null;
}

// ─── Chain: backend → Google → Nominatim direct ──────────────────────────────

async function geocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  return (await backendReverse(lat, lng))
      ?? (await googleReverse(lat, lng))
      ?? (await nominatimReverse(lat, lng));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const result = await geocode(lat, lng);
  return result?.name ?? 'Current Location';
}

export async function reverseGeocodeDetailed(lat: number, lng: number): Promise<GeocodeResult> {
  const result = await geocode(lat, lng);
  return result ?? { name: 'Drop pin on map', address: '' };
}
