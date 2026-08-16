import { z } from 'zod';

export const RegisterDeviceTokenSchema = z.object({
    deviceId: z.string().min(1, 'deviceId is required'),
    appType: z.enum(['buyer', 'rider', 'kitchen']),
    platform: z.enum(['android', 'ios', 'web']),
    fcmToken: z.string().min(1, 'fcmToken is required'),
});

export const DeactivateDeviceTokenSchema = z.object({
    deviceId: z.string().min(1, 'deviceId is required'),
    appType: z.enum(['buyer', 'rider', 'kitchen']).optional(),
});
