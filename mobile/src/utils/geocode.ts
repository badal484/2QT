const GOOGLE_MAPS_API_KEY = 'AIzaSyAEmfB-2bB76ng9ZjII7noxN9hPbq29VZU';

// Calls Google Geocoding API directly from the device — no backend hop, no cold-start risk.
// Returns a short, readable address string. Falls back to 'Current Location' on any failure.
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&result_type=sublocality|locality|administrative_area_level_3`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      // Prefer the shortest meaningful component: sublocality → locality → city
      const best = data.results[0];
      const components: { long_name: string; types: string[] }[] = best.address_components || [];

      const pick = (type: string) =>
        components.find(c => c.types.includes(type))?.long_name;

      const locality =
        pick('sublocality_level_1') ||
        pick('sublocality') ||
        pick('locality') ||
        pick('administrative_area_level_3') ||
        pick('administrative_area_level_2');

      const state = pick('administrative_area_level_1');
      const district = pick('administrative_area_level_2');

      // "Keredari, Hazaribagh, Jharkhand" style
      const parts = [locality, district !== locality ? district : null, state]
        .filter(Boolean) as string[];

      if (parts.length > 0) return parts.join(', ');

      // Fallback to full formatted address, stripping ", India"
      return best.formatted_address.replace(/, India$/, '');
    }
  } catch {}
  return 'Current Location';
}
