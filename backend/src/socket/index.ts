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

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication error'));

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
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

        socket.on('join_order', (orderId) => {
            socket.join(`order:${orderId}`);
        });

        // Rider location heartbeat via socket (avoids extra HTTP round-trip every 8s)
        if (user.role === 'rider' || user.role === 'rider_captain') {
            socket.on('update_location', async (data: { lat: number; lng: number }) => {
                try {
                    const riderId = user.userId;
                    const zoneId = user.zoneId;

                    // Store in Redis (60s TTL — if rider disappears, location expires)
                    await redis.set(
                        keys.riderLocation(riderId),
                        JSON.stringify({ lat: data.lat, lng: data.lng, updatedAt: new Date() }),
                        { EX: 60 }
                    );

                    // Zone capacity heartbeat
                    if (zoneId) {
                        const capacityKey = keys.activeRidersInZone(zoneId);
                        const now = Date.now();
                        await redis.zAdd(capacityKey, { score: now, value: riderId });
                        await redis.zRemRangeByScore(capacityKey, '-inf', now - 60000);
                    }

                    // Forward location to any customer watching this rider's active order
                    const { rows } = await query(
                        'SELECT current_order_id FROM users WHERE id = $1',
                        [riderId]
                    );
                    if (rows[0]?.current_order_id) {
                        io.to(`order:${rows[0].current_order_id}`).emit('rider_location', {
                            lat: data.lat,
                            lng: data.lng,
                        });
                    }
                } catch (_) {
                    // Non-critical — location update failure should never crash socket
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
        // Always emit to global riders room — catches riders with no zone_id set
        io.to('riders').emit(event, data);
        // Also emit to zone-specific room for targeted delivery
        if (zoneId) {
            io.to(`riders:${zoneId}`).emit(event, data);
        }
    }
};

export const emitToAll = (event: string, data: any) => {
    if (io) io.emit(event, data);
};
