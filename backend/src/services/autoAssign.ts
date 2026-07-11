import { query } from '../db';
import { redis, keys } from '../redis';
import { emitToUser, emitToRiders, emitToAdmin } from '../socket';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findBestRider(zoneId: string, kitchenLat: number, kitchenLng: number): Promise<string | null> {
    const { rows: riders } = await query(`
        SELECT u.id,
               COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled')) AS active_orders
        FROM users u
        LEFT JOIN orders o ON o.rider_id = u.id AND o.status NOT IN ('delivered', 'cancelled')
        WHERE u.zone_id = $1
          AND u.is_online = true
          AND u.is_verified = true
          AND u.role IN ('rider', 'rider_captain')
        GROUP BY u.id
        HAVING COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled')) < 2
        ORDER BY COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled')) ASC
    `, [zoneId]);

    if (riders.length === 0) return null;

    const candidates: { id: string; activeOrders: number; distKm: number }[] = [];

    for (const rider of riders) {
        // Skip riders in 60s opt-out cooldown
        const unavail = await redis.get(`2qt:auto_unavail:${rider.id}`).catch(() => null);
        if (unavail) continue;

        const locRaw = await redis.get(keys.riderLocation(rider.id)).catch(() => null);
        if (!locRaw) continue; // no GPS — rider is not actively sharing location

        try {
            const loc = JSON.parse(locRaw);
            const distKm = haversineKm(kitchenLat, kitchenLng, loc.lat, loc.lng);
            candidates.push({ id: rider.id, activeOrders: parseInt(rider.active_orders, 10), distKm });
        } catch { /* malformed GPS — skip */ }
    }

    if (candidates.length === 0) return null;

    // Idle riders first, then by distance to kitchen
    candidates.sort((a, b) => {
        if (a.activeOrders !== b.activeOrders) return a.activeOrders - b.activeOrders;
        return a.distKm - b.distKm;
    });

    return candidates[0].id;
}

export async function autoAssignOrder(orderId: string, attempt = 1): Promise<void> {
    try {
        const { rows } = await query(`
            SELECT o.id, o.display_id, o.zone_id, o.kitchen_id,
                   z.kitchen_lat, z.kitchen_lng
            FROM orders o
            JOIN zones z ON z.id = o.zone_id
            WHERE o.id = $1 AND o.status = 'ready_for_pickup' AND o.rider_id IS NULL
        `, [orderId]);

        if (!rows[0]) return; // order already assigned or status changed

        const order = rows[0];
        const kitchenLat = parseFloat(order.kitchen_lat);
        const kitchenLng = parseFloat(order.kitchen_lng);

        const riderId = await findBestRider(order.zone_id, kitchenLat, kitchenLng);

        if (!riderId) {
            // No GPS-visible rider — fall back to pool broadcast for this zone
            console.log(`[AUTO-ASSIGN] No eligible riders for ${order.display_id} (attempt ${attempt}), broadcasting to pool`);
            emitToRiders('new_available_mission', {
                orderId,
                displayId: order.display_id,
                status: 'ready_for_pickup',
            }, order.zone_id);
            return;
        }

        // Atomic assign — guard against race condition from a second trigger
        const { rowCount } = await query(`
            UPDATE orders
            SET rider_id = $1, auto_assigned = true
            WHERE id = $2 AND status = 'ready_for_pickup' AND rider_id IS NULL
        `, [riderId, orderId]);

        if (!rowCount) return; // race — someone else grabbed it first

        console.log(`[AUTO-ASSIGN] ${order.display_id} → rider ${riderId} (attempt ${attempt})`);

        emitToAdmin('order_status_update', {
            orderId,
            status: 'ready_for_pickup',
            riderId,
            autoAssigned: true,
        });

        // Notify the assigned rider with a 30s opt-out window
        emitToUser(riderId, 'order_auto_assigned', {
            orderId,
            displayId: order.display_id,
            optOutWindowMs: 30000,
        });

    } catch (err) {
        console.error('[AUTO-ASSIGN] Error:', err);
    }
}

export async function unassignAndReassign(orderId: string, riderId: string): Promise<void> {
    try {
        const { rowCount, rows } = await query(`
            UPDATE orders
            SET rider_id = NULL, auto_assigned = false
            WHERE id = $1 AND rider_id = $2 AND status = 'ready_for_pickup'
            RETURNING id, display_id, zone_id
        `, [orderId, riderId]);

        if (!rowCount) return; // already picked up or different rider

        console.log(`[AUTO-ASSIGN] Rider ${riderId} declined ${rows[0].display_id}, reassigning…`);

        // 60s cooldown so this rider is skipped in the next round
        redis.set(`2qt:auto_unavail:${riderId}`, '1', { EX: 60 }).catch(() => {});

        await autoAssignOrder(orderId, 2);
    } catch (err) {
        console.error('[AUTO-ASSIGN] unassignAndReassign error:', err);
    }
}
