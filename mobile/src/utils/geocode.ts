// Uses OpenStreetMap Nominatim — free, no API key, no billing required.
// Rate limit: 1 req/sec which is fine since we call it rarely (boot, drag end, locate me).
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': '2QT-FoodDelivery/1.0',
        'Accept-Language': 'en',
      },
    });
    clearTimeout(timer);
    const data = await res.json();

    if (data?.address) {
      const a = data.address;
      const locality =
        a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.city;
      const district = a.county || a.district || a.state_district;
      const state = a.state;

      // Build short readable string, deduplicated
      const parts: string[] = [locality, district, state].filter(Boolean) as string[];
      const unique = parts.filter((v, i, arr) => arr.indexOf(v) === i);
      if (unique.length > 0) return unique.join(', ');

      // Fallback: trim display_name to first 3 meaningful parts
      if (data.display_name) {
        return (data.display_name as string)
          .split(', ')
          .filter((p: string) => p !== 'India' && !/^\d{5,6}$/.test(p))
          .slice(0, 3)
          .join(', ');
      }
    }
  } catch {}
  return 'Current Location';
}
