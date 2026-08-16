import { query } from '../db';
import { redis, keys } from '../redis';
import { emitToUser, emitToRiders, emitToAdmin, emitToKitchen } from '../socket';
import { getAppSettingInt } from '../utils/appSettings';
import { NotificationService } from './notification.service';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Max distance between a busy rider's current delivery and a new order's delivery.
// If exceeded, the rider is skipped — they're heading in a different direction.
const MAX_SECOND_ORDER_DIST_KM = 5.0;

async function findBestRider(
    zoneId: string | null,
    kitchenLat: number,
    kitchenLng: number,
    isCodOrder = false,
    newDeliveryLat: number | null = null,
    newDeliveryLng: number | null = null,
): Promise<string | null> {
    // 1. Try matching riders in the specific zone first
    let { rows: riders } = await query(`
        SELECT u.id, u.current_lat, u.current_lng,
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
    `, [zoneId || null]);

    // Fallback: If no online riders in zone, search ALL online verified riders
    if (riders.length === 0) {
        const { rows: fallbackRiders } = await query(`
            SELECT u.id, u.current_lat, u.current_lng,
                   COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled')) AS active_orders
            FROM users u
            LEFT JOIN orders o ON o.rider_id = u.id AND o.status NOT IN ('delivered', 'cancelled')
            WHERE u.is_online = true
              AND u.is_verified = true
              AND u.role IN ('rider', 'rider_captain')
            GROUP BY u.id
            HAVING COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled')) < 2
            ORDER BY COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled')) ASC
        `);
        riders = fallbackRiders;
    }

    if (riders.length === 0) return null;

    const evaluateRiders = async (enforceCashLimit: boolean) => {
        const candidates: { id: string; activeOrders: number; distKm: number }[] = [];

        for (const rider of riders) {
            // Skip riders in 60s opt-out cooldown
            const unavail = await redis.get(`2qt:auto_unavail:${rider.id}`).catch(() => null);
            if (unavail) continue;

            // For COD orders: check cash limit if enforced
            if (isCodOrder && enforceCashLimit) {
                const [limitPaise, { rows: cashRows }] = await Promise.all([
                    getAppSettingInt('cod_cash_limit_paise', 200_000),
                    query(`
                        SELECT COALESCE(SUM(total_amount_paise), 0)::int AS cash_paise
                        FROM orders
                        WHERE rider_id = $1 AND payment_method = 'cod'
                          AND status = 'delivered' AND cod_cash_collected = FALSE
                    `, [rider.id]),
                ]);
                const cashInHand = parseInt(cashRows[0].cash_paise, 10);
                if (cashInHand >= limitPaise) continue;
            }

            const activeOrders = parseInt(rider.active_orders, 10);

            if (activeOrders > 0 && newDeliveryLat && newDeliveryLng) {
                const { rows: activeRows } = await query(`
                    SELECT COALESCE(o.delivery_location_lat, a.lat) AS dlat,
                           COALESCE(o.delivery_location_lng, a.lng) AS dlng
                    FROM orders o
                    LEFT JOIN addresses a ON a.id = o.address_id
                    WHERE o.rider_id = $1
                      AND o.status NOT IN ('delivered', 'cancelled')
                    LIMIT 1
                `, [rider.id]);

                if (activeRows[0]) {
                    const dlat = parseFloat(activeRows[0].dlat);
                    const dlng = parseFloat(activeRows[0].dlng);
                    if (!isNaN(dlat) && !isNaN(dlng)) {
                        const distBetweenDeliveries = haversineKm(dlat, dlng, newDeliveryLat, newDeliveryLng);
                        if (distBetweenDeliveries > MAX_SECOND_ORDER_DIST_KM) {
                            console.log(`[AUTO-ASSIGN] Skipping busy rider ${rider.id} — new delivery ${distBetweenDeliveries.toFixed(1)}km from current delivery (limit ${MAX_SECOND_ORDER_DIST_KM}km)`);
                            continue;
                        }
                    }
                }
            }

            // Check Redis location first, then fall back to database current_lat/lng
            let lat: number | null = null;
            let lng: number | null = null;
            const locRaw = await redis.get(keys.riderLocation(rider.id)).catch(() => null);
            if (locRaw) {
                try {
                    const loc = JSON.parse(locRaw);
                    lat = loc.lat;
                    lng = loc.lng;
                } catch {}
            }
            if (lat === null || lng === null) {
                if (rider.current_lat && rider.current_lng) {
                    lat = parseFloat(rider.current_lat);
                    lng = parseFloat(rider.current_lng);
                }
            }

            const distKm = (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && !isNaN(kitchenLat) && !isNaN(kitchenLng))
                ? haversineKm(kitchenLat, kitchenLng, lat, lng)
                : 0;

            candidates.push({ id: rider.id, activeOrders, distKm });
        }

        return candidates;
    };

    // First attempt with cash limit enforced
    let candidates = await evaluateRiders(true);
    // If no eligible rider found due to cash limit, relax cash limit as fallback
    if (candidates.length === 0 && isCodOrder) {
        candidates = await evaluateRiders(false);
    }

    if (candidates.length === 0) return null;

    // Idle riders first, then by distance to kitchen
    candidates.sort((a, b) => {
        if (a.activeOrders !== b.activeOrders) return a.activeOrders - b.activeOrders;
        return a.distKm - b.distKm;
    });

    return candidates[0].id;
}

// Find a ready_for_pickup order from the same kitchen suitable for batching.
// Two filters must both pass:
//   1. Delivery points ≤ 2 km apart (pre-filter for obvious non-batches)
//   2. Detour factor: the best batch route (K→A→B or K→B→A) must be
//      ≤ 40% longer than the farther single delivery. This rejects pairs
//      where one delivery is in the opposite direction from the other.
async function detectBatch(
    kitchenId: string,
    kitchenLat: number,
    kitchenLng: number,
    anchorOrderId: string,
    anchorDeliveryLat: number | null,
    anchorDeliveryLng: number | null,
    zoneId: string,
): Promise<string | null> {
    if (!anchorDeliveryLat || !anchorDeliveryLng) return null;
    if (isNaN(kitchenLat) || isNaN(kitchenLng)) return null;

    const MAX_DELIVERY_DIST_KM = 2.0;
    const MAX_DETOUR_FACTOR    = 1.4;

    const { rows } = await query(`
        SELECT o.id,
               COALESCE(o.delivery_location_lat, a.lat)  AS dlat,
               COALESCE(o.delivery_location_lng, a.lng)  AS dlng
        FROM orders o
        LEFT JOIN addresses a ON a.id = o.address_id
        WHERE o.kitchen_id = $1
          AND o.id        != $2
          AND o.zone_id    = $3
          AND o.status     = 'ready_for_pickup'
          AND o.rider_id  IS NULL
        LIMIT 10
    `, [kitchenId, anchorOrderId, zoneId]);

    const directA = haversineKm(kitchenLat, kitchenLng, anchorDeliveryLat, anchorDeliveryLng);

    for (const row of rows) {
        const dlat = parseFloat(row.dlat);
        const dlng = parseFloat(row.dlng);
        if (isNaN(dlat) || isNaN(dlng)) continue;

        // Filter 1: delivery points must be close
        const betweenDeliveries = haversineKm(anchorDeliveryLat, anchorDeliveryLng, dlat, dlng);
        if (betweenDeliveries > MAX_DELIVERY_DIST_KM) continue;

        // Filter 2: detour check — reject if one delivery is a backtrack from the other.
        // Compare best batch route against the longer of the two individual routes.
        const directB   = haversineKm(kitchenLat, kitchenLng, dlat, dlng);
        const routeAB   = directA + betweenDeliveries; // K→A→B
        const routeBA   = directB + betweenDeliveries; // K→B→A
        const maxDirect = Math.max(directA, directB);
        const bestRoute = Math.min(routeAB, routeBA);

        if (bestRoute > maxDirect * MAX_DETOUR_FACTOR) continue;

        return row.id;
    }
    return null;
}

export async function autoAssignOrder(orderId: string, attempt = 1): Promise<void> {
    try {
        const { rows } = await query(`
            SELECT o.id, o.display_id, o.zone_id, o.kitchen_id, o.payment_method,
                   COALESCE(o.delivery_location_lat, a.lat)  AS delivery_lat,
                   COALESCE(o.delivery_location_lng, a.lng)  AS delivery_lng,
                   z.kitchen_lat, z.kitchen_lng
            FROM orders o
            JOIN zones z ON z.id = o.zone_id
            LEFT JOIN addresses a ON a.id = o.address_id
            WHERE o.id = $1 AND o.status IN ('preparing', 'ready_for_pickup') AND o.rider_id IS NULL
        `, [orderId]);

        if (!rows[0]) return; // already assigned or status changed

        const order = rows[0];
        const kitchenLat = parseFloat(order.kitchen_lat);
        const kitchenLng = parseFloat(order.kitchen_lng);
        const deliveryLat = order.delivery_lat ? parseFloat(order.delivery_lat) : null;
        const deliveryLng = order.delivery_lng ? parseFloat(order.delivery_lng) : null;

        const riderId = await findBestRider(order.zone_id, kitchenLat, kitchenLng, order.payment_method === 'cod', deliveryLat, deliveryLng);

        if (!riderId) {
            console.log(`[AUTO-ASSIGN] No eligible riders for ${order.display_id} (attempt ${attempt}) — alerting admin`);
            const payload = {
                orderId,
                displayId: order.display_id,
                zoneId: order.zone_id,
                attempt,
                message: `No available rider found for ${order.display_id}. Manual assignment needed.`,
            };
            emitToAdmin('order_needs_manual_assignment', payload);
            // Also emit to kitchen room so kitchen_manager web page receives it
            if (order.kitchen_id) emitToKitchen(order.kitchen_id, 'order_needs_manual_assignment', payload);
            if (attempt >= 2) {
                // Absolute last resort — broadcast to all online riders in zone
                console.log(`[AUTO-ASSIGN] Last resort broadcast for ${order.display_id}`);
                emitToRiders('order_needs_rider', {
                    orderId,
                    displayId: order.display_id,
                }, order.zone_id);
            }
            return;
        }

        // Kitchen-synced batch check — only bundle orders that are BOTH already ready
        const batchOrderId = await detectBatch(
            order.kitchen_id,
            kitchenLat,
            kitchenLng,
            orderId,
            deliveryLat,
            deliveryLng,
            order.zone_id,
        );

        // Assign anchor order atomically
        const { rowCount } = await query(`
            UPDATE orders
            SET rider_id = $1, auto_assigned = true
            WHERE id = $2 AND status IN ('preparing', 'ready_for_pickup') AND rider_id IS NULL
        `, [riderId, orderId]);

        if (!rowCount) return; // race — someone else grabbed it

        console.log(`[AUTO-ASSIGN] ${order.display_id} → rider ${riderId} (attempt ${attempt})`);

        // Assign batch partner if found (ignore failure — it may have been claimed already)
        let batchDisplayId: string | undefined;
        if (batchOrderId) {
            const { rowCount: batchRowCount, rows: batchRows } = await query(`
                UPDATE orders
                SET rider_id = $1, auto_assigned = true
                WHERE id = $2 AND status IN ('preparing', 'ready_for_pickup') AND rider_id IS NULL
                RETURNING display_id
            `, [riderId, batchOrderId]);

            if (batchRowCount) {
                batchDisplayId = batchRows[0].display_id;
                console.log(`[AUTO-ASSIGN] Batched ${batchDisplayId} with ${order.display_id} → rider ${riderId}`);
            }
        }

        emitToAdmin('order_status_update', {
            orderId,
            status: 'ready_for_pickup',
            riderId,
            autoAssigned: true,
            batchOrderId: batchDisplayId ? batchOrderId : undefined,
        });

        // Notify the rider — include batch info if applicable
        emitToUser(riderId, 'order_auto_assigned', {
            orderId,
            displayId: order.display_id,
            batchOrderId: batchDisplayId ? batchOrderId : undefined,
            batchDisplayId,
            optOutWindowMs: 30000,
        });
        // Push fallback — the socket event above never reaches a rider whose app is
        // closed, and unlike the pool broadcast this is a specific assignment they
        // need to know about even if they're not actively looking at the app.
        NotificationService.send('broadcast_message', {
            userId: riderId,
            title: '🛵 New Delivery Assigned!',
            body: `Order #${order.display_id} has been assigned to you — open the app to accept.`,
            screen: 'RiderHome',
        }).catch(() => {});

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

        if (!rowCount) return;

        console.log(`[AUTO-ASSIGN] Rider ${riderId} declined ${rows[0].display_id}, reassigning…`);

        // 60s cooldown so this rider is skipped in the next round
        redis.set(`2qt:auto_unavail:${riderId}`, '1', { EX: 60 }).catch(() => {});

        await autoAssignOrder(orderId, 2);
    } catch (err) {
        console.error('[AUTO-ASSIGN] unassignAndReassign error:', err);
    }
}
