import { ENV } from '../config/env';

export interface GeocodeResult {
  name: string;    // short label for HomeScreen header
  address: string; // full address for map picker subtitle
}

// Nominatim directly from device — free, no key, works when backend is cold
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
      const finalAddress = rawFull || fallbackFull;
      if (finalName) return { name: finalName, address: finalAddress || finalName };
    }
  } catch {
    clearTimeout(timer);
  }
  return null;
}

async function callBackend(lat: number, lng: number): Promise<GeocodeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${ENV.API_URL}/menu/geocode/reverse?lat=${lat}&lng=${lng}`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data?.name) return { name: data.name, address: data.address || data.name };
  } catch {
    clearTimeout(timer);
  }
  return null;
}

// Backend first (Google → Nominatim on server), then direct Nominatim if backend is cold/slow
async function geocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const result = await callBackend(lat, lng);
  if (result) return result;
  return nominatimReverse(lat, lng);
}

// Short name only — used by HomeScreen header and globalLocation.addressText
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const result = await geocode(lat, lng);
  return result?.name ?? 'Current Location';
}

// Full result — used by AddressBookScreen bottom bar (title + subtitle)
export async function reverseGeocodeDetailed(lat: number, lng: number): Promise<GeocodeResult> {
  const result = await geocode(lat, lng);
  return result ?? { name: 'Drop pin on map', address: '' };
}
