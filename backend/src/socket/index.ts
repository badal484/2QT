import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { redisPub, redisSub, redis, keys } from '../redis';
import { query } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export let io: Server;

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
                const { rows } = await query('SELECT kitchen_id, zone_id FROM users WHERE id = $1', [decoded.userId]);
                if (rows[0]) {
                    decoded.kitchenId = rows[0].kitchen_id ?? decoded.kitchenId;
                    decoded.zoneId = rows[0].zone_id ?? decoded.zoneId;
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
        
        if (user.role === 'chef' || user.role === 'super_admin' || user.role === 'partner_kitchen') {
            if (user.kitchenId) socket.join(`kitchen:${user.kitchenId}`);
        }

        if (user.role === 'super_admin') {
            socket.join('admin');
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
                        io.to(`order:${row.id}`).emit('rider_location', {
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

// Helper to emit events from anywhere
export const emitToUser = (userId: string, event: string, data: any) => {
    if (io) io.to(`user:${userId}`).emit(event, data);
};

export const emitToOrder = (orderId: string, event: string, data: any) => {
    if (io) io.to(`order:${orderId}`).emit(event, data);
};

export const emitToKitchen = (kitchenId: string, event: string, data: any) => {
    if (io) io.to(`kitchen:${kitchenId}`).emit(event, data);
};

export const emitToAdmin = (event: string, data: any) => {
    if (io) io.to('admin').emit(event, data);
};

export const emitToRiders = (event: string, data: any, zoneId?: string) => {
    if (io) {
        if (zoneId) {
            // Zone-specific: only emit to riders in that zone (avoids double-delivery to zoned riders)
            io.to(`riders:${zoneId}`).emit(event, data);
        } else {
            // Broadcast: no zone filter — catch all riders
            io.to('riders').emit(event, data);
        }
    }
};

export const emitToAll = (event: string, data: any) => {
    if (io) io.emit(event, data);
};
