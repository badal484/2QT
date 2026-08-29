import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import jwt from 'jsonwebtoken';
import { redisPub, redisSub, redis, keys } from '../redis';
import { query } from '../db';
import { canJoinOrderRoom } from '../utils/orderAuth';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');

// `io` is only ever set by the API process (the one actually hosting the Socket.IO
// server). `remoteEmitter` is set by any process that needs to fire socket events
// WITHOUT hosting a server — e.g. the worker process, which runs cron jobs and BullMQ
// jobs that call emitToKitchen/emitToAdmin/etc. It publishes onto the exact same Redis
// pub/sub channels @socket.io/redis-adapter subscribes to, so clients connected to the
// API instances receive these events identically either way.
export let io: Server | undefined;
let remoteEmitter: Emitter | undefined;

// Called once by the worker process at startup. Do NOT call this from the API process —
// the API process uses the real `io` server instance instead (see initSocket below).
export const initSocketEmitter = () => {
    remoteEmitter = new Emitter(redisPub);
    console.log('[SOCKET] Redis emitter initialized (non-serving process).');
    return remoteEmitter;
};

// Whichever of the two is active in this process. Both expose the same
// `.to(room).emit(event, data)` / `.emit(event, data)` chainable surface.
const emitter = (): Server | Emitter | undefined => io ?? remoteEmitter;

export const initSocket = (server: any) => {
    io = new Server(server, {
        cors: {
            origin: '*', // Adjust for production
            methods: ['GET', 'POST']
        }
    });

    io.adapter(createAdapter(redisPub, redisSub));

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            (socket as any).user = { userId: 'guest', role: 'guest' };
            return next();
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            try {
                const { rows } = await query('SELECT kitchen_id, zone_id, dine_in_restaurant_id, restaurant_id FROM users WHERE id = $1', [decoded.userId]);
                if (rows[0]) {
                    decoded.kitchenId = rows[0].kitchen_id ?? decoded.kitchenId;
                    decoded.zoneId = rows[0].zone_id ?? decoded.zoneId;
                    decoded.restaurantId = rows[0].dine_in_restaurant_id ?? decoded.restaurantId;
                    // tenantRestaurantId (Phase 3/7): the SaaS restaurant relationship, distinct
                    // from restaurantId above (the unrelated dine-in relationship) — mirrors
                    // middleware/auth.ts's authenticate(). Needed so isAuthorizedForOrder's
                    // Phase 4 tenant cross-check also works for a socket connection, not just HTTP.
                    decoded.tenantRestaurantId = rows[0].restaurant_id ?? null;
                }
            } catch { /* non-critical — fall back to JWT payload values */ }
            (socket as any).user = decoded;
            next();
        } catch (err) {
            (socket as any).user = { userId: 'guest', role: 'guest' };
            next();
        }
    });

    io.on('connection', (socket) => {
        const user = (socket as any).user;
        console.log(`Socket connected: ${socket.id} (User: ${user.userId}, Role: ${user.role})`);

        // Join rooms
        socket.join(`user:${user.userId}`);
        
        if (user.role === 'chef' || user.role === 'super_admin' || user.role === 'partner_kitchen' || user.role === 'kitchen_manager' || user.role === 'packer') {
            if (user.kitchenId) socket.join(`kitchen:${user.kitchenId}`);
        }

        if (user.role === 'super_admin') {
            socket.join('admin');
        }

        if (user.role === 'partner') {
            socket.join(`partner:${user.userId}`);
            // Partner also needs restaurant room to receive dine-in real-time events
            if (user.restaurantId) socket.join(`restaurant:${user.restaurantId}`);
        }

        if (user.role === 'dine_in_staff' && user.restaurantId) {
            socket.join(`restaurant:${user.restaurantId}`);
        }

        if (user.role === 'support' || user.role === 'super_admin') {
            socket.join('support');
        }

        if (user.role === 'rider' || user.role === 'rider_captain' || user.role === 'super_admin') {
            socket.join('riders');
            if (user.zoneId) socket.join(`riders:${user.zoneId}`);
        }

        socket.on('join_kitchen', (kitchenId: string) => {
            if (kitchenId) {
                console.log(`Socket ${socket.id} joined kitchen:${kitchenId}`);
                socket.join(`kitchen:${kitchenId}`);
            }
            socket.join('kitchen_all');
        });

        // Security fix, Phase 7 Step 0 (High-severity IDOR, found in Phase 6): this previously
        // joined the socket to ANY order's room for ANY client-supplied orderId with no
        // ownership check at all — any authenticated (or even unauthenticated "guest") socket
        // could subscribe to another user's live rider-GPS stream and order-status broadcasts
        // indefinitely. canJoinOrderRoom() below reuses routes/order.ts's isAuthorizedForOrder()
        // — the same, single authorization rule already enforced by GET /orders/:id/tracking and
        // the other order endpoints — rather than inventing a second, parallel authorization
        // model. Server-derived identity only (socket.user, populated by the io.use() auth
        // middleware above from the verified JWT + a fresh DB lookup); the client-supplied
        // orderId is used only to look up the real order row, never trusted as proof of ownership.
        socket.on('join_order', async (orderId) => {
            if (typeof orderId !== 'string' || !orderId) return;

            try {
                const { rows } = await query(
                    'SELECT customer_id, rider_id, kitchen_id, restaurant_id FROM orders WHERE id = $1',
                    [orderId]
                );
                const order = rows[0];
                // Unknown order id — reject safely, no room joined, nothing about the order's
                // existence is revealed to the caller (no error emitted, just no-op).
                if (!canJoinOrderRoom(user, order)) return;

                socket.join(`order:${orderId}`);

                // Immediately push last known rider location so buyer doesn't wait for next heartbeat
                if (order.rider_id) {
                    const loc = await redis.get(keys.riderLocation(order.rider_id)).catch(() => null);
                    if (loc) {
                        const parsed = JSON.parse(loc);
                        socket.emit('rider_location', { lat: parsed.lat, lng: parsed.lng });
                    }
                }
            } catch (_) {}
        });

        // Rider location heartbeat via socket (avoids extra HTTP round-trip every 5s)
        if (user.role === 'rider' || user.role === 'rider_captain') {
            socket.on('update_location', async (data: { lat: number; lng: number }) => {
                const riderId = user.userId;
                const zoneId = user.zoneId;

                // 1. Forward to customer order room FIRST — real-time priority, must not be
                //    blocked by Redis writes. DB query is cheap and non-failing.
                try {
                    const { rows } = await query(
                        'SELECT id FROM orders WHERE rider_id = $1 AND status NOT IN (\'delivered\', \'cancelled\')',
                        [riderId]
                    );
                    for (const row of rows) {
                        socket.to(`order:${row.id}`).emit('rider_location', {
                            lat: data.lat,
                            lng: data.lng
                        });
                    }
                } catch (_) {}

                // 2. Persist to Redis (fire-and-forget — Redis errors must not block real-time path)
                redis.set(
                    keys.riderLocation(riderId),
                    JSON.stringify({ lat: data.lat, lng: data.lng, updatedAt: new Date() }),
                    { EX: 300 }  // 5 min TTL — covers stationary riders waiting at kitchen
                ).catch(() => {});

                // 3. Zone capacity heartbeat (fire-and-forget)
                if (zoneId) {
                    const capacityKey = keys.activeRidersInZone(zoneId);
                    const now = Date.now();
                    redis.zAdd(capacityKey, { score: now, value: riderId })
                        .then(() => redis.zRemRangeByScore(capacityKey, '-inf', now - 60000))
                        .catch(() => {});
                }
            });
        }

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

// Helper to emit events from anywhere. Works from the API process (via the real `io`
// server) or from the worker process (via the Redis emitter set up in initSocketEmitter) —
// callers never need to know which one is active.
export const emitToUser = (userId: string, event: string, data: any) => {
    emitter()?.to(`user:${userId}`).emit(event, data);
};

export const emitToOrder = (orderId: string, event: string, data: any) => {
    emitter()?.to(`order:${orderId}`).emit(event, data);
};

export const emitToKitchen = (kitchenId: string, event: string, data: any) => {
    const e = emitter();
    if (!e) return;
    if (kitchenId) {
        e.to(`kitchen:${kitchenId}`).emit(event, data);
    }
    e.to('admin').to('kitchen_all').emit(event, { ...data, kitchenId });
};

export const emitToAdmin = (event: string, data: any) => {
    emitter()?.to('admin').emit(event, data);
};

export const emitToRiders = (event: string, data: any, zoneId?: string) => {
    const e = emitter();
    if (!e) return;
    if (zoneId) {
        // Zone-specific: only emit to riders in that zone (avoids double-delivery to zoned riders)
        e.to(`riders:${zoneId}`).emit(event, data);
    } else {
        // Broadcast: no zone filter — catch all riders
        e.to('riders').emit(event, data);
    }
};

export const emitToAll = (event: string, data: any) => {
    emitter()?.emit(event, data);
};

export const emitToPartner = (partnerId: string, event: string, data: any) => {
    emitter()?.to(`partner:${partnerId}`).emit(event, data);
};

export const emitToRestaurant = (restaurantId: string, event: string, data: any) => {
    emitter()?.to(`restaurant:${restaurantId}`).emit(event, data);
};

export const emitToSupport = (event: string, data: any) => {
    emitter()?.to('support').emit(event, data);
};
