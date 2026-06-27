import { ENV } from '../config/env';

export interface GeocodeResult {
  name: string;    // short label shown in HomeScreen header
  address: string; // full address shown in map picker subtitle
}

// Google Geocoding HTTP API — called directly from device, same as Swish
async function googleReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${ENV.GOOGLE_GEOCODING_KEY}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.length > 0) {
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
      // Strip Plus Code prefix from segments, strip country
      const address = (data.results[0].formatted_address as string || '')
        .split(', ')
        .map((p: string) => p.replace(/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}\s*/, ''))
        .filter((p: string) => p && p !== 'India')
        .join(', ')
        .trim();
      if (name) return { name, address: address || name };
    }
  } catch {
    clearTimeout(timer);
  }
  return null;
}

// Nominatim — free fallback when Google fails (no key, works offline)
async function nominatimReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { signal: controller.signal, headers: { 'User-Agent': '2QT-FoodDelivery/1.0', 'Accept-Language': 'en' } },
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data) {
      const a = data.address || {};
      const name = data.name ||
                   a.road || a.suburb || a.neighbourhood || a.quarter ||
                   a.village || a.hamlet || a.town || a.city_district || a.city ||
                   a.county || a.state_district || a.state;
      const locality = a.suburb || a.neighbourhood || a.village || a.town ||
                       a.county || a.state_district;
      const rawFull = [a.road, locality, a.county || a.state_district, a.state]
        .filter(Boolean).filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i).join(', ');
      const fallbackFull = (data.display_name as string || '')
        .split(', ').filter((p: string) => p !== 'India' && !/^\d{5,6}$/.test(p)).join(', ');
      const finalName = name || fallbackFull.split(', ')[0];
      const finalAddress = rawFull.split(', ').length >= 2 ? rawFull : (fallbackFull || rawFull);
      if (finalName) return { name: finalName, address: finalAddress || finalName };
    }
  } catch {
    clearTimeout(timer);
  }
  return null;
}

// Google first (direct, no backend), Nominatim as fallback
async function geocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const result = await googleReverse(lat, lng);
  if (result) return result;
  return nominatimReverse(lat, lng);
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const result = await geocode(lat, lng);
  return result?.name ?? 'Current Location';
}

export async function reverseGeocodeDetailed(lat: number, lng: number): Promise<GeocodeResult> {
  const result = await geocode(lat, lng);
  return result ?? { name: 'Drop pin on map', address: '' };
}
