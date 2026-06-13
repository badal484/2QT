import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { redisPub, redisSub } from '../redis';

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
