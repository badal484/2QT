import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import jwt from 'jsonwebtoken';
import { redisPub, redisSub, redis, keys } from '../redis';
import { query } from '../db';

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
        if (!token) return next(new Error('Authentication error'));

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            // Refresh kitchen_id/zone_id from DB — JWT payload may be stale
            // (e.g. admin assigned a zone/kitchen after the user last logged in)
            try {
                const { rows } = await query('SELECT kitchen_id, zone_id, dine_in_restaurant_id FROM users WHERE id = $1', [decoded.userId]);
                if (rows[0]) {
                    decoded.kitchenId = rows[0].kitchen_id ?? decoded.kitchenId;
                    decoded.zoneId = rows[0].zone_id ?? decoded.zoneId;
                    decoded.restaurantId = rows[0].dine_in_restaurant_id ?? decoded.restaurantId;
                }
            } catch { /* non-critical — fall back to JWT payload values */ }
            (socket as any).user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
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

        socket.on('join_order', async (orderId) => {
            socket.join(`order:${orderId}`);
            // Immediately push last known rider location so buyer doesn't wait for next heartbeat
            try {
                const { rows } = await query(
                    'SELECT rider_id FROM orders WHERE id = $1',
                    [orderId]
                );
                if (rows[0]?.rider_id) {
                    const loc = await redis.get(keys.riderLocation(rows[0].rider_id)).catch(() => null);
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
    emitter()?.to(`kitchen:${kitchenId}`).emit(event, data);
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
