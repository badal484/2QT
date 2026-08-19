import { query } from '../db';

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY ?? process.env.GOOGLE_MAPS_API_KEY;

/**
 * Calls Google Distance Matrix API to get real driving road distance between
 * origin and destination.
 */
export async function fetchGoogleRoadDistanceMetres(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
): Promise<number | null> {
    if (!GOOGLE_MAPS_KEY) return null;

    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
            `?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&key=${GOOGLE_MAPS_KEY}`;

        const res = await fetch(url);
        const data = await res.json() as any;
        const metres: number | undefined = data?.rows?.[0]?.elements?.[0]?.distance?.value;

        if (metres != null && metres > 0) {
            return metres;
        }
    } catch (err) {
        console.warn('[DistanceService] Google Distance Matrix API call failed:', err);
    }
    return null;
}

/**
 * Calculates and stores real driving road distance on the order.
 */
export async function computeAndStoreRoadDistance(
    orderId: string,
    kitchenId: string,
    addressId: string,
): Promise<void> {
    const [{ rows: kRows }, { rows: aRows }] = await Promise.all([
        query('SELECT lat, lng FROM kitchens WHERE id = $1', [kitchenId]),
        query('SELECT lat, lng FROM addresses WHERE id = $1', [addressId]),
    ]);

    const kLat = parseFloat(kRows[0]?.lat);
    const kLng = parseFloat(kRows[0]?.lng);
    const aLat = parseFloat(aRows[0]?.lat);
    const aLng = parseFloat(aRows[0]?.lng);

    if (isNaN(kLat) || isNaN(kLng) || isNaN(aLat) || isNaN(aLng)) return;

    let metres = await fetchGoogleRoadDistanceMetres(kLat, kLng, aLat, aLng);
    if (!metres) {
        metres = Math.round(calculateGeodesicRoadMetres(kLat, kLng, aLat, aLng));
    }

    if (metres > 0) {
        await query('UPDATE orders SET delivery_distance_metres = $1 WHERE id = $2', [metres, orderId]);
    }
}

/**
 * Real Road Distance calculation with actual driving road factor (1.3x routing factor).
 * Used when direct live Google API query is unavailable.
 */
export function calculateGeodesicRoadMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in metres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const straightDistance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    // Multiply by 1.3 to reflect real road turns and city driving routes
    return straightDistance * 1.3;
}
