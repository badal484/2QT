import { query } from '../db';

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY ?? process.env.GOOGLE_MAPS_API_KEY;

/**
 * Calls Google Distance Matrix API to get real road distance between
 * kitchen and customer, then stores it on the order row.
 * Fire-and-forget — caller should .catch(() => {}).
 */
export async function computeAndStoreRoadDistance(
    orderId: string,
    kitchenId: string,
    addressId: string,
): Promise<void> {
    if (!GOOGLE_MAPS_KEY) return; // graceful fallback to haversine

    const [{ rows: kRows }, { rows: aRows }] = await Promise.all([
        query('SELECT lat, lng FROM kitchens WHERE id = $1', [kitchenId]),
        query('SELECT lat, lng FROM addresses WHERE id = $1', [addressId]),
    ]);

    const kLat = parseFloat(kRows[0]?.lat);
    const kLng = parseFloat(kRows[0]?.lng);
    const aLat = parseFloat(aRows[0]?.lat);
    const aLng = parseFloat(aRows[0]?.lng);

    if (isNaN(kLat) || isNaN(kLng) || isNaN(aLat) || isNaN(aLng)) return;

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${kLat},${kLng}&destinations=${aLat},${aLng}&mode=driving&key=${GOOGLE_MAPS_KEY}`;

    const res = await fetch(url);
    const data = await res.json() as any;
    const metres: number | undefined = data?.rows?.[0]?.elements?.[0]?.distance?.value;

    if (metres != null && metres > 0) {
        await query('UPDATE orders SET delivery_distance_metres = $1 WHERE id = $2', [metres, orderId]);
    }
}

/**
 * Haversine fallback (straight-line) — used when road distance is unavailable.
 */
export function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
