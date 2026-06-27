import { ENV } from '../config/env';

export interface GeocodeResult {
  name: string;    // short label for HomeScreen header: "Keredari" or "Jharkhand State Highway 7"
  address: string; // full address for map picker subtitle: "V367+C5M, ..., Jharkhand 825321"
}

async function callBackend(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = `${ENV.API_URL}/menu/geocode/reverse?lat=${lat}&lng=${lng}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data?.name) return { name: data.name, address: data.address || data.name };
  } catch {
    clearTimeout(timer);
  }
  return null;
}

// Short name only — used by HomeScreen header and globalLocation.addressText
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const result = await callBackend(lat, lng);
  return result?.name ?? 'Current Location';
}

// Full result — used by AddressBookScreen bottom bar (title + subtitle like Swish)
export async function reverseGeocodeDetailed(lat: number, lng: number): Promise<GeocodeResult> {
  const result = await callBackend(lat, lng);
  return result ?? { name: 'Drop pin on map', address: '' };
}
